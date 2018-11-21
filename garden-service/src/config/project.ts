/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as Joi from "joi"
import { safeDump } from "js-yaml"
import { ProjectConfigContext } from "./config-context"
import {
  joiArray,
  joiIdentifier,
  joiVariables,
  Primitive,
  joiRepositoryUrl,
} from "./common"
import { resolveTemplateString, resolveTemplateStrings } from "../template-string"
import { findByName, getNames } from "../util/util"
import { ParameterError, ConfigurationError } from "../exceptions"
import { fixedPlugins } from "../plugins/plugins"
import { merge, keyBy, omit } from "lodash"
import * as Bluebird from "bluebird"

export interface ProviderConfig {
  name: string
  dependencies: string[]
  [key: string]: any
}

export const providerDependenciesSchema = joiArray(Joi.string())
  .description(
    "List of names of providers that this provider depends on. Those providers will be loaded before this one, " +
    "and their configuration made available to this provider via template strings and the plugin action context.",
  )
  .example(["kubernetes"])

export const providerConfigBaseSchema = Joi.object()
  .keys({
    name: joiIdentifier().required()
      .description("The name of the provider plugin to use.")
      .example("local-kubernetes"),
    dependencies: providerDependenciesSchema,
  })
  .unknown(true)
  .meta({ extendable: true })

export interface Provider<T extends ProviderConfig = any> {
  name: string
  dependencies: string[]
  config: T
}

export interface CommonEnvironmentConfig {
  providers: ProviderConfig[]  // further validated by each plugin
  variables: { [key: string]: Primitive }
}

export const environmentConfigSchema = Joi.object()
  .keys({
    providers: joiArray(providerConfigBaseSchema)
      .unique("name")
      .description(
        "A list of providers that should be used for this environment, and their configuration. " +
        "Please refer to individual plugins/providers for details on how to configure them.",
      ),
    variables: joiVariables()
      .description("A key/value map of variables that modules can reference when using this environment."),
  })

export interface EnvironmentConfig extends CommonEnvironmentConfig {
  name: string
}

export interface Environment extends EnvironmentConfig {
  providers: Provider[]
}

export const environmentSchema = environmentConfigSchema
  .keys({
    name: Joi.string()
      .required()
      .description("The name of the current environment."),
  })

export interface SourceConfig {
  name: string
  repositoryUrl: string
}

export const projectSourceSchema = Joi.object()
  .keys({
    name: joiIdentifier()
      .required()
      .description("The name of the source to import"),
    repositoryUrl: joiRepositoryUrl()
      .required(),
  })

export const projectSourcesSchema = joiArray(projectSourceSchema)
  .unique("name")
  .description("A list of remote sources to import into project.")

export interface ProjectConfig {
  name: string
  defaultEnvironment: string
  environmentDefaults: CommonEnvironmentConfig
  environments: EnvironmentConfig[]
  sources?: SourceConfig[]
}

export const defaultProviders = [
  { name: "container" },
]

export const defaultEnvironments: EnvironmentConfig[] = [
  {
    name: "local",
    providers: [
      {
        name: "local-kubernetes",
        dependencies: [],
      },
    ],
    variables: {},
  },
]

const environmentDefaults = {
  providers: [],
  variables: {},
}

export const projectNameSchema = joiIdentifier()
  .required()
  .description("The name of the project.")
  .example("my-sweet-project")

export const projectSchema = Joi.object()
  .keys({
    name: projectNameSchema,
    defaultEnvironment: Joi.string()
      .default("", "<first specified environment>")
      .description("The default environment to use when calling commands without the `--env` parameter."),
    environmentDefaults: environmentConfigSchema
      .default(() => environmentDefaults, safeDump(environmentDefaults))
      .example(environmentDefaults)
      .description(
        "Default environment settings. These are inherited (but can be overridden) by each configured environment.",
      ),
    environments: joiArray(environmentConfigSchema.keys({ name: joiIdentifier().required() }))
      .unique("name")
      .default(() => ({ ...defaultEnvironments }), safeDump(defaultEnvironments))
      .description("A list of environments to configure for the project.")
      .example(defaultEnvironments),
    sources: projectSourcesSchema,
  })
  .required()
  .description(
    "Configuration for a Garden project. This should be specified in the garden.yml file in your project root.",
  )

// this is used for default handlers in the action handler
export const defaultProvider: Provider = {
  name: "_default",
  dependencies: [],
  config: {},
}

/**
 * Resolve the template strings in the provided project config, excluding the provider configurations.
 */
export async function resolveProjectConfig(projectConfig: ProjectConfig, environmentName?: string) {
  const context = new ProjectConfigContext()

  // Resolve all template strings except the provider configurations.
  projectConfig = {
    ...await resolveTemplateStrings(omit(projectConfig, ["environmentDefaults", "environments"]), context),
    environmentDefaults: await resolveEnvironmentConfig(projectConfig.environmentDefaults, context),
    environments: await Bluebird.map(projectConfig.environments, (env) => resolveEnvironmentConfig(env, context)),
  }

  const projectName = projectConfig.name

  // First figure out which environment we're running and validate it.
  if (!environmentName) {
    environmentName = projectConfig.defaultEnvironment
  }

  const environmentConfig = findByName(projectConfig.environments, environmentName)

  if (!environmentConfig) {
    throw new ParameterError(`Project ${projectName} does not specify environment ${environmentName}`, {
      projectName,
      environmentName,
      definedEnvironments: getNames(projectConfig.environments),
    })
  }

  // Then resolve the provider configs.
  if (!environmentConfig.providers || environmentConfig.providers.length === 0) {
    throw new ConfigurationError(`Environment '${environmentName}' does not specify any providers`, {
      projectName,
      environmentName,
      environmentConfig,
    })
  }

  // Load built-in providers.
  const fixedProviders = fixedPlugins.map(name => ({ name, dependencies: [] }))

  // Merge environment defaults with the selected environment's configuration.
  const providers: ProviderConfig[] = Object.values(merge(
    fixedProviders,
    keyBy(environmentDefaults.providers, "name"),
    keyBy(environmentConfig.providers, "name"),
  ))

  // Resolve the project configuration based on selected environment
  const variables = merge({}, environmentDefaults.variables, environmentConfig.variables)

  return { projectConfig, environmentConfig, providers, variables }
}

async function resolveEnvironmentConfig<T extends CommonEnvironmentConfig>(
  config: T, context: ProjectConfigContext,
): Promise<T> {
  return {
    ...await resolveTemplateStrings(omit(<any>config, ["providers"]), context),
    // Only resolve built-in fields with the project context for providers.
    providers: Bluebird.map(config.providers, async (provider) => ({
      ...provider,
      name: await resolveTemplateString(provider.name, context),
      dependencies: await resolveTemplateStrings(provider.dependencies, context),
    })),
  }
}

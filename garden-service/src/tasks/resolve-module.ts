/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { BaseTask, ModuleTask, ModuleTaskParams } from "./base"
import { Module, moduleFromConfig } from "../types/module"
import { collectTemplateReferences, resolveTemplateStrings } from "../template-string"
import { ConfigurationError } from "../exceptions"
import { PrepareEnvironmentTask } from "./prepare-environment"
import { ModuleConfigContext } from "../config/config-context"
import { TaskResults } from "../task-graph"

export class ResolveModuleTask extends ModuleTask<ModuleTaskParams, Module> {
  type = "resolve-module"

  async computeDependencies() {
    // Collect all template string references
    const references = await collectTemplateReferences(this.moduleConfig)
    const tasks: BaseTask[] = []

    // Pull out keys that require other tasks to be resolved.
    for (const key of references) {
      if (key[0] === "modules") {
        if (!key[1]) {
          throw this.badKeyError(key)
        }

        const moduleConfig = await this.garden.getModuleConfig(key[1])
        const version = await this.garden.resolveModuleVersion(moduleConfig)

        tasks.push(new ResolveModuleTask({
          garden: this.garden,
          version,
          moduleConfig,
          force: false,
        }))

      } else if (key[0] === "provider") {
        if (!key[1]) {
          throw this.badKeyError(key)
        }
        const provider = await this.garden.getProvider(key[1])

        tasks.push(new PrepareEnvironmentTask({
          garden: this.garden,
          provider,
          allowUserInput: false,
          force: this.force,
        }))
      }
    }

    tasks.push(...await this.getProviderTasks("configure"))

    return tasks
  }

  private badKeyError(key: string[]) {
    return new ConfigurationError(
      `Could not resolve template key ${key.join(".")} in module ${this.moduleConfig.name}`,
      { moduleConfig: this.moduleConfig, key: key.join(".") },
    )
  }

  protected getName() {
    return this.moduleConfig.name
  }

  getDescription() {
    return `resolving module ${this.moduleConfig.name}`
  }

  async process(dependencyResults: TaskResults) {
    // Build the config context from the dependency results.
    const providers = await this.getResolvedProviders(dependencyResults)
    const modules = await this.getResolvedModules(dependencyResults)
    const configContext = new ModuleConfigContext(this.garden, providers, modules)

    // Resolve the templated strings.
    const resolvedConfig = await resolveTemplateStrings(this.moduleConfig, configContext)

    // Handle external sources.
    if (resolvedConfig.repositoryUrl) {
      resolvedConfig.path = await this.garden.loadExtSourcePath({
        name: resolvedConfig.name,
        repositoryUrl: resolvedConfig.repositoryUrl,
        sourceType: "module",
      })
    }

    // Pass through the provider.
    const configureHandler = await this.garden.getModuleActionHandler({
      actionType: "configure",
      moduleType: resolvedConfig.type,
    })
    const ctx = this.garden.getPluginContext(configureHandler["pluginName"])

    const parsedConfig = await configureHandler({ ctx, moduleConfig: resolvedConfig })

    return moduleFromConfig(this.garden, parsedConfig, this.version)
  }
}

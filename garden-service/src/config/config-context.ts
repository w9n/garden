/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { isString } from "lodash"
import { Module } from "../types/module"
import {
  PrimitiveMap,
  isPrimitive,
  Primitive,
  joiIdentifierMap,
  joiStringMap,
  joiPrimitive,
  joiPrimitiveMap,
} from "./common"
import { providerConfigBaseSchema, Provider } from "./project"
import { ConfigurationError } from "../exceptions"
import { Service } from "../types/service"
import { resolveTemplateString } from "../template-string"
import * as Joi from "joi"
import { Garden } from "../garden"
import { LogEntry } from "../logger/log-entry"

export type ContextKey = string[]

export interface ContextResolveParams {
  key: ContextKey
  nodePath: ContextKey
  // a list of previously resolved paths, used to detect circular references
  stack?: string[]
}

export function schema(joiSchema: Joi.Schema) {
  return (target, propName) => {
    target.constructor._schemas = { ...target.constructor._schemas || {}, [propName]: joiSchema }
  }
}

// Note: we're using classes here to be able to use decorators to describe each context node and key
export abstract class ConfigContext {
  private readonly _rootContext: ConfigContext
  private readonly _resolvedValues: { [path: string]: string }

  constructor(rootContext?: ConfigContext) {
    this._rootContext = rootContext || this
    this._resolvedValues = {}
  }

  static getSchema() {
    const schemas = (<any>this)._schemas
    return Joi.object().keys(schemas).required()
  }

  async resolve({ key, nodePath, stack }: ContextResolveParams): Promise<Primitive> {
    const path = key.join(".")
    const fullPath = nodePath.concat(key).join(".")

    // if the key has previously been resolved, return it directly
    const resolved = this._resolvedValues[path]

    if (resolved) {
      return resolved
    }

    stack = [...stack || []]

    if (stack.includes(fullPath)) {
      throw new ConfigurationError(
        `Circular reference detected when resolving key ${path} (${stack.join(" -> ")})`,
        {
          nodePath,
          fullPath,
          stack,
        },
      )
    }

    // keep track of which resolvers have been called, in order to detect circular references
    let value: any = this

    for (let p = 0; p < key.length; p++) {
      const nextKey = key[p]
      const lookupPath = key.slice(0, p + 1)
      const remainder = key.slice(p + 1)
      const nestedNodePath = nodePath.concat(lookupPath)
      const stackEntry = nestedNodePath.join(".")

      if (nextKey.startsWith("_")) {
        value = undefined
      } else {
        value = value instanceof Map ? value.get(nextKey) : value[nextKey]
      }

      if (typeof value === "function") {
        // call the function to resolve the value, then continue
        value = await value()
      }

      // handle nested contexts
      if (value instanceof ConfigContext) {
        const nestedKey = remainder
        stack.push(stackEntry)
        value = await value.resolve({ key: nestedKey, nodePath: nestedNodePath, stack })
        break
      }

      // handle templated strings in context variables
      if (isString(value)) {
        stack.push(stackEntry)
        value = await resolveTemplateString(value, this._rootContext, stack)
      }

      if (value === undefined) {
        break
      }
    }

    if (value === undefined) {
      throw new ConfigurationError(`Could not find key: ${path}`, {
        nodePath,
        fullPath,
        stack,
      })
    }

    if (!isPrimitive(value)) {
      throw new ConfigurationError(
        `Config value at ${path} exists but is not a primitive (string, number or boolean)`,
        {
          value,
          path,
          fullPath,
        },
      )
    }

    this._resolvedValues[path] = value
    return value
  }
}

class LocalContext extends ConfigContext {
  @schema(
    joiStringMap(Joi.string()).description(
      "A map of all local environment variables (see https://nodejs.org/api/process.html#process_process_env).",
    ),
  )
  public env: typeof process.env

  @schema(
    Joi.string()
      .description(
        "A string indicating the platform that the framework is running on " +
        "(see https://nodejs.org/api/process.html#process_process_platform)",
      )
      .example("posix"),
  )
  public platform: string

  constructor(root: ConfigContext) {
    super(root)
    this.env = process.env
    this.platform = process.platform
  }
}

/**
 * This context is available for template strings under the `project` key in configuration files.
 */
export class ProjectConfigContext extends ConfigContext {
  @schema(LocalContext.getSchema())
  public local: LocalContext

  constructor() {
    super()
    this.local = new LocalContext(this)
  }
}

class EnvironmentContext extends ConfigContext {
  @schema(
    Joi.string()
      .description("The name of the environment Garden is running against.")
      .example("local"),
  )
  public name: string

  constructor(root: ConfigContext, name: string) {
    super(root)
    this.name = name
  }
}

class ProviderContext extends ConfigContext {
  @schema(
    joiPrimitiveMap()
      .description("The outputs that the provider exposes once initialized.")
      .example({ "cluster-hostname": "foo.bar.com" }),
  )
  public outputs: PrimitiveMap

  constructor(root: ConfigContext, outputs: PrimitiveMap) {
    super(root)
    this.outputs = outputs
  }
}

/**
 * This context is available for template strings under the `project.environments[].providers` key in
 * configuration files. It is a superset of the context available under the `project` key.
 */
export class ProviderConfigContext extends ConfigContext {
  @schema(
    EnvironmentContext.getSchema()
      .description("Information about the environment that Garden is running against."),
  )
  public environment: EnvironmentContext

  @schema(
    joiIdentifierMap(providerConfigBaseSchema)
      .description("A map of all configured plugins/providers for this environment, their configuration and outputs.")
      .example({
        kubernetes: {
          name: "local-kubernetes",
          config: {
            context: "my-kube-context",
          },
          outputs: {},
        },
      }),
  )
  public providers: Map<string, () => Promise<ProviderContext>>

  @schema(
    joiIdentifierMap(joiPrimitive())
      .description("A map of all variables defined in the project configuration.")
      .example({ "team-name": "bananaramallama", "some-service-endpoint": "https://someservice.com/api/v2" }),
  )
  public variables: PrimitiveMap

  constructor(
    garden: Garden,
    log: LogEntry,
    providers: Provider[],
  ) {
    super()

    const _this = this

    this.environment = new EnvironmentContext(this, garden.environmentName)

    this.providers = new Map(providers.map((provider) =>
      <[string, () => Promise<ProviderContext>]>[provider.name, async (p) => {
        const outputs = await garden.actions.getEnvironmentOutputs({ log, pluginName: p.name })
        return new ProviderContext(_this, outputs)
      }],
    ))

    this.variables = garden.variables
  }
}

const exampleOutputs = { ingress: "http://my-service/path/to/endpoint" }
const exampleVersion = "v17ad4cb3fd"

class ServiceContext extends ConfigContext {
  @schema(
    joiIdentifierMap(joiPrimitive())
      .description("The outputs defined by the service (see individual plugins for details).")
      .example(exampleOutputs),
    )
  public outputs: () => Promise<PrimitiveMap>

  constructor(root: ConfigContext, garden: Garden, service: Service) {
    super(root)
    this.outputs = () => garden.actions.getServiceOutputs({ service })
  }
}

class ModuleContext extends ConfigContext {
  @schema(
    Joi.string()
      .description("The build path of the module.")
      .example("/home/me/code/my-project/.garden/build/my-module"),
  )
  public buildPath: string

  @schema(
    joiIdentifierMap(joiPrimitive())
      .description("The outputs defined by the module (see individual plugins for details).")
      .example(exampleOutputs),
    )
  public outputs: PrimitiveMap

  @schema(Joi.string().description("The local path of the module.").example("/home/me/code/my-project/my-module"))
  public path: string

  @schema(
    joiIdentifierMap(ServiceContext.getSchema())
      .description("Retrieve information about services that are defined in the project.")
      .example({ "my-service": { outputs: exampleOutputs } }),
  )
  public services: Map<string, ServiceContext>

  @schema(Joi.string().description("The current version of the module.").example(exampleVersion))
  public version: string

  constructor(root: ConfigContext, garden: Garden, module: Module) {
    super(root)
    this.buildPath = module.buildPath

    this.outputs = module.outputs

    this.path = module.path

    // TODO: add "service" shorthand for single-service modules?

    this.services = new Map(module.services.map((service) =>
      <[string, ServiceContext]>[name, new ServiceContext(this, garden, service)],
    ))

    this.version = module.version.versionString
  }
}

/**
 * This context is available for template strings under the `module` key in configuration files.
 * It is a superset of the context available under the `project.environments[].providers` key.
 */
export class ModuleConfigContext extends ProviderConfigContext {
  @schema(
    joiIdentifierMap(ModuleContext.getSchema())
      .description("Retrieve information about modules that are defined in the project.")
      .example({ "my-module": { path: "/home/me/code/my-project/my-module", version: exampleVersion } }),
  )
  public modules: Map<string, ModuleContext>

  constructor(
    garden: Garden,
    providers: Provider[],
    modules: Module[],
  ) {
    super(garden, providers)

    const _this = this

    this.environment = new EnvironmentContext(_this, garden.environmentName)

    this.modules = new Map(modules.map((module) =>
      <[string, ModuleContext]>[module.name, new ModuleContext(_this, garden, module)],
    ))
  }
}

/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as Joi from "joi"
import { getEnvVarName } from "../util/util"
import { PrimitiveMap, joiEnvVars, joiIdentifierMap, joiPrimitive, joiUserIdentifier } from "../config/common"
import { Module, getModuleKey } from "./module"
import { serviceOutputsSchema, ServiceConfig, serviceConfigSchema } from "../config/service"
import { validate } from "../config/common"
import dedent = require("dedent")
import { format } from "url"
import { moduleVersionSchema } from "../vcs/vcs"
import { Garden } from "../garden"
import { uniq } from "lodash"
import { ConfigGraph } from "../config-graph"
import normalizeUrl = require("normalize-url")

export interface Service<M extends Module = Module, S extends Module = Module> {
  name: string
  module: M
  config: M["serviceConfigs"][0]
  sourceModule: S
  spec: M["serviceConfigs"][0]["spec"]
}

export const serviceSchema = Joi.object()
  .options({ presence: "required" })
  .keys({
    name: joiUserIdentifier()
      .description("The name of the service."),
    module: Joi.object().unknown(true),   // This causes a stack overflow: Joi.lazy(() => moduleSchema),
    sourceModule: Joi.object().unknown(true),   // This causes a stack overflow: Joi.lazy(() => moduleSchema),
    config: serviceConfigSchema,
    spec: Joi.object()
      .description("The raw configuration of the service (specific to each plugin)."),
  })

export async function serviceFromConfig<M extends Module = Module>
  (graph: ConfigGraph, module: M, config: ServiceConfig): Promise<Service<M>> {

  const sourceModule = config.sourceModuleName ? await graph.getModule(config.sourceModuleName) : module

  return {
    name: config.name,
    module,
    config,
    sourceModule,
    spec: config.spec,
  }
}

export type ServiceState = "ready" | "deploying" | "stopped" | "unhealthy" | "unknown" | "outdated" | "missing"
export const serviceStates: ServiceState[] = [
  "ready", "deploying", "stopped", "unhealthy", "unknown", "outdated", "missing",
]

/**
 * Given a list of states, return a single state representing the list.
 */
export function combineStates(states: ServiceState[]): ServiceState {
  const unique = uniq(states)

  if (unique.length === 1) {
    return unique[0]
  }

  if (unique.includes("unhealthy")) {
    return "unhealthy"
  }

  if (unique.includes("deploying")) {
    return "deploying"
  }

  return "outdated"
}

// TODO: support TCP, UDP and gRPC
export type ServiceProtocol = "http" | "https"  // | "tcp" | "udp"

export interface ServiceIngressSpec {
  hostname?: string
  path: string
  port: number
  protocol: ServiceProtocol
}

export interface ServiceIngress extends ServiceIngressSpec {
  hostname: string
}

export const ingressHostnameSchema = Joi.string()
  .hostname()
  .description(dedent`
    The hostname that should route to this service. Defaults to the default hostname
    configured in the provider configuration.

    Note that if you're developing locally you may need to add this hostname to your hosts file.
  `)

const portSchema = Joi.number()
  .description(dedent`
    The port number that the service is exposed on internally.
    This defaults to the first specified port for the service.
  `)

export const serviceIngressSpecSchema = Joi.object()
  .keys({
    hostname: ingressHostnameSchema,
    port: portSchema,
    path: Joi.string()
      .default("/")
      .description("The ingress path that should be matched to route to this service."),
    protocol: Joi.string()
      .only("http", "https")
      .required()
      .description("The protocol to use for the ingress."),
  })

export const serviceIngressSchema = serviceIngressSpecSchema
  .keys({
    hostname: Joi.string()
      .required()
      .description("The hostname where the service can be accessed."),
    port: portSchema
      .required(),
  })
  .unknown(true)
  .description("A description of a deployed service ingress.")

// TODO: revise this schema
export interface ServiceStatus {
  providerId?: string
  providerVersion?: string
  version?: string
  state?: ServiceState
  runningReplicas?: number
  ingresses?: ServiceIngress[],
  lastMessage?: string
  lastError?: string
  createdAt?: string
  updatedAt?: string
  detail?: any
}

export const serviceStatusSchema = Joi.object()
  .keys({
    providerId: Joi.string()
      .description("The ID used for the service by the provider (if not the same as the service name)."),
    providerVersion: Joi.string()
      .description("The provider version of the deployed service (if different from the Garden module version."),
    version: Joi.string()
      .description("The Garden module version of the deployed service."),
    state: Joi.string()
      .only("ready", "deploying", "stopped", "unhealthy", "unknown", "outdated", "missing")
      .default("unknown")
      .description("The current deployment status of the service."),
    runningReplicas: Joi.number()
      .description("How many replicas of the service are currently running."),
    ingresses: Joi.array()
      .items(serviceIngressSchema)
      .description("List of currently deployed ingress endpoints for the service."),
    lastMessage: Joi.string()
      .allow("")
      .description("Latest status message of the service (if any)."),
    lastError: Joi.string()
      .description("Latest error status message of the service (if any)."),
    createdAt: Joi.string()
      .description("When the service was first deployed by the provider."),
    updatedAt: Joi.string()
      .description("When the service was last updated by the provider."),
    detail: Joi.object()
      .meta({ extendable: true })
      .description("Additional detail, specific to the provider."),
  })

export type RuntimeContext = {
  envVars: PrimitiveMap
  dependencies: {
    [name: string]: {
      version: string,
      outputs: PrimitiveMap,
    },
  },
}

const runtimeDependencySchema = Joi.object()
  .keys({
    version: moduleVersionSchema,
    outputs: joiEnvVars()
      .description("The outputs provided by the service (e.g. ingress URLs etc.)."),
  })

export const runtimeContextSchema = Joi.object()
  .options({ presence: "required" })
  .keys({
    envVars: Joi.object().pattern(/.+/, joiPrimitive())
      .default(() => ({}), "{}")
      .unknown(false)
      .description(
        "Key/value map of environment variables. Keys must be valid POSIX environment variable names " +
        "(must be uppercase) and values must be primitives.",
      ),
    dependencies: joiIdentifierMap(runtimeDependencySchema)
      .description("Map of all the services that this service or test depends on, and their metadata."),
  })

export async function prepareRuntimeContext(
  garden: Garden, graph: ConfigGraph, module: Module, serviceDependencies: Service[],
): Promise<RuntimeContext> {
  const buildDepKeys = module.build.dependencies.map(dep => getModuleKey(dep.name, dep.plugin))
  const buildDependencies: Module[] = await graph.getModules(buildDepKeys)
  const { versionString } = module.version
  const envVars = {
    GARDEN_VERSION: versionString,
  }

  for (const [key, value] of Object.entries(garden.variables)) {
    const envVarName = `GARDEN_VARIABLES_${key.replace(/-/g, "_").toUpperCase()}`
    envVars[envVarName] = value
  }

  const deps = {}

  for (const m of buildDependencies) {
    deps[m.name] = {
      version: m.version.versionString,
      outputs: {},
    }
  }

  for (const dep of serviceDependencies) {
    if (!deps[dep.name]) {
      deps[dep.name] = {
        version: dep.module.version.versionString,
        outputs: {},
      }
    }
    const depContext = deps[dep.name]

    const outputs = {
      ...dep.config.outputs,
    }
    const serviceEnvName = getEnvVarName(dep.name)

    validate(outputs, serviceOutputsSchema, { context: `outputs for service ${dep.name}` })

    for (const [key, value] of Object.entries(outputs)) {
      const envVarName = `GARDEN_SERVICES_${serviceEnvName}_${key}`.toUpperCase()

      envVars[envVarName] = value
      depContext.outputs[key] = value
    }
  }

  return {
    envVars,
    dependencies: deps,
  }
}

export async function getServiceRuntimeContext(garden: Garden, graph: ConfigGraph, service: Service) {
  const deps = await graph.getDependencies("service", service.name, false)
  return prepareRuntimeContext(garden, graph, service.module, deps.service)
}

export function getIngressUrl(ingress: ServiceIngress) {
  return normalizeUrl(format({
    protocol: ingress.protocol,
    hostname: ingress.hostname,
    port: ingress.port,
    pathname: ingress.path,
  }))
}

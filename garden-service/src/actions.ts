/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import Bluebird = require("bluebird")
import chalk from "chalk"
import { Garden } from "./garden"
import { PrimitiveMap } from "./config/common"
import { Module } from "./types/module"
import { ModuleActions, ServiceActions, PluginActions, TaskActions } from "./types/plugin/plugin"
import {
  BuildResult,
  BuildStatus,
  DeleteSecretResult,
  EnvironmentStatusMap,
  ExecInServiceResult,
  GetSecretResult,
  GetServiceLogsResult,
  ModuleActionOutputs,
  PushResult,
  RunResult,
  ServiceActionOutputs,
  SetSecretResult,
  TestResult,
  PluginActionOutputs,
  PublishResult,
  RunTaskResult,
  TaskActionOutputs,
  HotReloadResult,
  EnvironmentStatus,
  ConfigureProviderResult,
  PrepareEnvironmentResult,
} from "./types/plugin/outputs"
import {
  BuildModuleParams,
  DeleteSecretParams,
  DeployServiceParams,
  DeleteServiceParams,
  ExecInServiceParams,
  GetSecretParams,
  GetBuildStatusParams,
  GetServiceLogsParams,
  GetServiceOutputsParams,
  GetServiceStatusParams,
  GetTestResultParams,
  ModuleActionParams,
  PluginActionContextParams,
  PluginActionParams,
  PluginActionParamsBase,
  PluginServiceActionParamsBase,
  PushModuleParams,
  HotReloadParams,
  RunModuleParams,
  RunServiceParams,
  ServiceActionParams,
  SetSecretParams,
  TestModuleParams,
  GetEnvironmentStatusParams,
  PluginModuleActionParamsBase,
  PublishModuleParams,
  PluginTaskActionParamsBase,
  RunTaskParams,
  TaskActionParams,
  PrepareEnvironmentParams,
  CleanupEnvironmentParams,
  GetEnvironmentOutputsParams,
  ConfigureProviderParams,
} from "./types/plugin/params"
import {
  Service,
  ServiceStatus,
  prepareRuntimeContext,
} from "./types/service"
import { mapValues, keyBy, omit } from "lodash"
import { Omit } from "./util/util"
import { RuntimeContext } from "./types/service"
import { processServices, ProcessResults } from "./process"
import { getDependantTasksForModule } from "./tasks/helpers"
import { LogEntry } from "./logger/log-entry"
import { createPluginContext } from "./plugin-context"

type TypeGuard = {
  readonly [P in keyof (PluginActionParams | ModuleActionParams<any>)]: (...args: any[]) => Promise<any>
}

export interface EnvironmentStatus {
  providers: EnvironmentStatusMap
  services: { [name: string]: ServiceStatus }
}

export interface DeployServicesParams {
  log: LogEntry
  serviceNames?: string[]
  force?: boolean
  forceBuild?: boolean
}

// avoid having to specify common params on each action helper call
type ActionHelperParams<T extends PluginActionParamsBase> =
  Omit<T, keyof PluginActionContextParams> & { pluginName: string }

type ModuleActionHelperParams<T extends PluginModuleActionParamsBase> =
  Omit<T, keyof PluginActionContextParams> & { pluginName?: string }
// additionally make runtimeContext param optional

type ServiceActionHelperParams<T extends PluginServiceActionParamsBase> =
  Omit<T, "module" | "runtimeContext" | keyof PluginActionContextParams>
  & { runtimeContext?: RuntimeContext, pluginName?: string }

type TaskActionHelperParams<T extends PluginTaskActionParamsBase> =
  Omit<T, "module" | keyof PluginActionContextParams>
  & { runtimeContext?: RuntimeContext, pluginName?: string }

export class ActionHelper implements TypeGuard {
  constructor(private garden: Garden) { }

  //===========================================================================
  //region Environment Actions
  //===========================================================================

<<<<<<< HEAD
  async getEnvironmentStatus(
    { pluginName, log }: ActionHelperParams<GetEnvironmentStatusParams>,
  ): Promise<EnvironmentStatusMap> {
    const handlers = this.garden.getActionHandlers("getEnvironmentStatus", pluginName)
    const logEntry = log.debug({
      msg: "Getting status...",
      status: "active",
      section: `${this.garden.environment.name} environment`,
    })
    const res = await Bluebird.props(mapValues(handlers, h => h({ ...this.commonParams(h, logEntry) })))
    logEntry.setSuccess("Ready")
    return res
=======
  async configureProvider(params: ConfigureProviderParams & { pluginName: string }): Promise<ConfigureProviderResult> {
    const handler = await this.garden.getActionHandler({
      actionType: "configureProvider",
      defaultHandler: async ({ config }: ConfigureProviderParams) => ({
        name: config.name,
        dependencies: config.dependencies,
        config,
      }),
    })
    return handler(params)
  }

  async getEnvironmentStatus(params: ActionHelperParams<GetEnvironmentStatusParams>): Promise<EnvironmentStatus> {
    return this.callActionHandler({ actionType: "getEnvironmentStatus", params })
>>>>>>> feat: terraform WIP
  }

  /**
   * Checks environment status and calls prepareEnvironment for each provider that isn't flagged as ready.
   *
   * If any of the getEnvironmentStatus handlers returns needUserInput=true, this throws and guides the user to
   * run `garden init`
   */
<<<<<<< HEAD
  async prepareEnvironment(
    { force = false, pluginName, log, allowUserInput = false }:
      { force?: boolean, pluginName?: string, log: LogEntry, allowUserInput?: boolean },
  ) {
    const handlers = this.garden.getActionHandlers("prepareEnvironment", pluginName)
    // FIXME: We're calling getEnvironmentStatus before preparing the environment.
    // Results in 404 errors for unprepared/missing services.
    // See: https://github.com/garden-io/garden/issues/353
    const statuses = await this.getEnvironmentStatus({ pluginName, log })

    const needUserInput = Object.entries(statuses)
      .map(([name, status]) => ({ ...status, name }))
      .filter(status => status.needUserInput === true)

    if (!allowUserInput && needUserInput.length > 0) {
      const names = needUserInput.map(s => s.name).join(", ")
      const msgPrefix = needUserInput.length === 1
        ? `Plugin ${names} has been updated or hasn't been configured, and requires user input.`
        : `Plugins ${names} have been updated or haven't been configured, and require user input.`

      throw new ConfigurationError(
        `${msgPrefix}. Please run \`garden init\` and then re-run this command.`,
        { statuses },
      )
    }

    const output = {}

    // sequentially go through the preparation steps, to allow plugins to request user input
    for (const [name, handler] of Object.entries(handlers)) {
      const status = statuses[name] || { ready: false }

      if (status.ready && !force) {
        continue
      }

      const envLogEntry = log.info({
        status: "active",
        section: name,
        msg: "Preparing environment...",
      })

      await handler({ ...this.commonParams(handler, log), force, status, log: envLogEntry })

      envLogEntry.setSuccess("Configured")

      output[name] = true
    }
=======
  async prepareEnvironment(params: ActionHelperParams<PrepareEnvironmentParams>): Promise<PrepareEnvironmentResult> {
    return this.callActionHandler({ actionType: "prepareEnvironment", params })
  }
>>>>>>> feat: terraform WIP

  async cleanupEnvironment(params: ActionHelperParams<CleanupEnvironmentParams>): Promise<EnvironmentStatus> {
    await this.callActionHandler({ actionType: "cleanupEnvironment", params })
    return this.getEnvironmentStatus(params)
  }

<<<<<<< HEAD
  async cleanupEnvironment(
    { pluginName, log }: ActionHelperParams<CleanupEnvironmentParams>,
  ): Promise<EnvironmentStatusMap> {
    const handlers = this.garden.getActionHandlers("cleanupEnvironment", pluginName)
    await Bluebird.each(values(handlers), h => h({ ...this.commonParams(h, log) }))
    return this.getEnvironmentStatus({ pluginName, log })
=======
  async getEnvironmentOutputs(params: ActionHelperParams<GetEnvironmentOutputsParams>): Promise<PrimitiveMap> {
    const { outputs } = await this.callActionHandler({ actionType: "getEnvironmentOutputs", params })
    return outputs
>>>>>>> feat: terraform WIP
  }

  async getSecret(params: ActionHelperParams<GetSecretParams>): Promise<GetSecretResult> {
    return this.callActionHandler({ actionType: "getSecret", params })
  }

  async setSecret(params: ActionHelperParams<SetSecretParams>): Promise<SetSecretResult> {
    return this.callActionHandler({ actionType: "setSecret", params })
  }

  async deleteSecret(params: ActionHelperParams<DeleteSecretParams>): Promise<DeleteSecretResult> {
    return this.callActionHandler({ actionType: "deleteSecret", params })
  }

  //endregion

  //===========================================================================
  //region Module Actions
  //===========================================================================

  async getBuildStatus<T extends Module>(
    params: ModuleActionHelperParams<GetBuildStatusParams<T>>,
  ): Promise<BuildStatus> {
    return this.callModuleHandler({
      params,
      actionType: "getBuildStatus",
      defaultHandler: async () => ({ ready: false }),
    })
  }

  async build<T extends Module>(params: ModuleActionHelperParams<BuildModuleParams<T>>): Promise<BuildResult> {
    await this.garden.buildDir.syncDependencyProducts(params.module)
    return this.callModuleHandler({ params, actionType: "build" })
  }

  async pushModule<T extends Module>(params: ModuleActionHelperParams<PushModuleParams<T>>): Promise<PushResult> {
    return this.callModuleHandler({ params, actionType: "pushModule", defaultHandler: dummyPushHandler })
  }

  async publishModule<T extends Module>(
    params: ModuleActionHelperParams<PublishModuleParams<T>>,
  ): Promise<PublishResult> {
    return this.callModuleHandler({ params, actionType: "publishModule", defaultHandler: dummyPublishHandler })
  }

  async runModule<T extends Module>(params: ModuleActionHelperParams<RunModuleParams<T>>): Promise<RunResult> {
    return this.callModuleHandler({ params, actionType: "runModule" })
  }

  async hotReload<T extends Module>(params: ModuleActionHelperParams<HotReloadParams<T>>)
    : Promise<HotReloadResult> {
    return this.garden.hotReload(params.module.name, async () => {
      return this.callModuleHandler(({ params, actionType: "hotReload" }))
    })
  }

  async testModule<T extends Module>(params: ModuleActionHelperParams<TestModuleParams<T>>): Promise<TestResult> {
    return this.callModuleHandler({ params, actionType: "testModule" })
  }

  async getTestResult<T extends Module>(
    params: ModuleActionHelperParams<GetTestResultParams<T>>,
  ): Promise<TestResult | null> {
    return this.callModuleHandler({
      params,
      actionType: "getTestResult",
      defaultHandler: async () => null,
    })
  }

  //endregion

  //===========================================================================
  //region Service Actions
  //===========================================================================

  async getServiceStatus(params: ServiceActionHelperParams<GetServiceStatusParams>): Promise<ServiceStatus> {
    return this.callServiceHandler({ params, actionType: "getServiceStatus" })
  }

  async deployService(params: ServiceActionHelperParams<DeployServiceParams>): Promise<ServiceStatus> {
    return this.callServiceHandler({ params, actionType: "deployService" })
  }

  async deleteService(params: ServiceActionHelperParams<DeleteServiceParams>): Promise<ServiceStatus> {
    const log = params.log.info({
      section: params.service.name,
      msg: "Deleting...",
      status: "active",
    })
    return this.callServiceHandler({
      params: { ...params, log },
      actionType: "deleteService",
      defaultHandler: dummyDeleteServiceHandler,
    })
  }

  async getServiceOutputs(params: ServiceActionHelperParams<GetServiceOutputsParams>): Promise<PrimitiveMap> {
    const { outputs } = await this.callServiceHandler({
      params,
      actionType: "getServiceOutputs",
      defaultHandler: async () => ({ outputs: {} }),
    })
    return outputs
  }

  async execInService(params: ServiceActionHelperParams<ExecInServiceParams>): Promise<ExecInServiceResult> {
    return this.callServiceHandler({ params, actionType: "execInService" })
  }

  async getServiceLogs(params: ServiceActionHelperParams<GetServiceLogsParams>): Promise<GetServiceLogsResult> {
    return this.callServiceHandler({ params, actionType: "getServiceLogs", defaultHandler: dummyLogStreamer })
  }

  async runService(params: ServiceActionHelperParams<RunServiceParams>): Promise<RunResult> {
    return this.callServiceHandler({ params, actionType: "runService" })
  }

  //endregion

  //===========================================================================
  //region Task Methods
  //===========================================================================

  async runTask(params: TaskActionHelperParams<RunTaskParams>): Promise<RunTaskResult> {
    return this.callTaskHandler({ params, actionType: "runTask" })
  }

  //endregion

  //===========================================================================
  //region Helper Methods
  //===========================================================================

<<<<<<< HEAD
  private async getBuildDependencies(module: Module): Promise<ModuleMap> {
    const dependencies = await this.garden.resolveDependencyModules(module.build.dependencies, [])
    return keyBy(dependencies, "name")
  }

  async getStatus({ log }: { log: LogEntry }): Promise<EnvironmentStatus> {
    const envStatus: EnvironmentStatusMap = await this.getEnvironmentStatus({ log })
=======
  async getStatus(): Promise<ContextStatus> {
    const providers = await this.garden.getProviders()
    const providerStatus = await Bluebird.map(providers, (provider) => {
      return this.getEnvironmentStatus({ pluginName: provider.name })
    })

>>>>>>> feat: terraform WIP
    const services = keyBy(await this.garden.getServices(), "name")

    const serviceStatus = await Bluebird.props(mapValues(services, async (service: Service) => {
      const serviceDependencies = await this.garden.getServices(service.config.dependencies)
      const runtimeContext = await prepareRuntimeContext(this.garden, log, service.module, serviceDependencies)
      return this.getServiceStatus({ log, service, runtimeContext })
    }))

    return {
      providers: keyBy(providerStatus, "name"),
      services: serviceStatus,
    }
  }

  async deployServices(
    { serviceNames, force = false, forceBuild = false, log }: DeployServicesParams,
  ): Promise<ProcessResults> {
    return processServices({
      serviceNames,
      garden: this.garden,
      log,
      watch: false,
      handler: async (module) => getDependantTasksForModule({
        garden: this.garden,
        log,
        module,
        hotReloadServiceNames: [],
        force,
        forceBuild,
      }),
    })
  }

  //endregion

  // TODO: find a nicer way to do this (like a type-safe wrapper function)
  private commonParams(handler, log: LogEntry): PluginActionParamsBase {
    return {
      ctx: createPluginContext(this.garden, handler["pluginName"]),
      // TODO: find a better way for handlers to log during execution
      log,
    }
  }

  private async callActionHandler<T extends keyof Omit<PluginActions, "configureProvider">>(
    { params, actionType, defaultHandler }:
      {
        params: ActionHelperParams<PluginActionParams[T]>,
        actionType: T,
        defaultHandler?: PluginActions[T],
      },
  ): Promise<PluginActionOutputs[T]> {
    const handler = this.garden.getActionHandler({
      actionType,
      pluginName: params.pluginName,
      defaultHandler,
    })
    const handlerParams: PluginActionParams[T] = {
<<<<<<< HEAD
      ...this.commonParams(handler, <any>params.log),
      ...<object>params,
=======
      ...this.commonParams(handler),
      ...<object>omit(params, ["pluginName"]),
>>>>>>> feat: terraform WIP
    }
    return (<Function>handler)(handlerParams)
  }

  private async callModuleHandler<T extends keyof Omit<ModuleActions, "describeType" | "configure">>(
    { params, actionType, defaultHandler }:
      { params: ModuleActionHelperParams<ModuleActionParams[T]>, actionType: T, defaultHandler?: ModuleActions[T] },
  ): Promise<ModuleActionOutputs[T]> {
    // the type system is messing me up here, not sure why I need the any cast... - j.e.
    const { module, pluginName } = <any>params
    const handler = await this.garden.getModuleActionHandler({
      moduleType: module.type,
      actionType,
      pluginName,
      defaultHandler,
    })

    const handlerParams: any = {
      ...this.commonParams(handler, <any>params.log),
      ...<object>params,
      module: omit(module, ["_ConfigType"]),
    }
    // TODO: figure out why this doesn't compile without the function cast
    return (<Function>handler)(handlerParams)
  }

  async callServiceHandler<T extends keyof ServiceActions>(
    { params, actionType, defaultHandler }:
      { params: ServiceActionHelperParams<ServiceActionParams[T]>, actionType: T, defaultHandler?: ServiceActions[T] },
  ): Promise<ServiceActionOutputs[T]> {
    const { log, service } = <any>params
    const module = service.module

    const handler = await this.garden.getModuleActionHandler({
      moduleType: module.type,
      actionType,
      pluginName: params.pluginName,
      defaultHandler,
    })

    // TODO: figure out why this doesn't compile without the casts
    const deps = await this.garden.getServices(service.config.dependencies)
    const runtimeContext = ((<any>params).runtimeContext || await prepareRuntimeContext(this.garden, log, module, deps))

    const handlerParams: any = {
      ...this.commonParams(handler, log),
      ...<object>params,
      module,
      runtimeContext,
    }

    return (<Function>handler)(handlerParams)
  }

  private async callTaskHandler<T extends keyof TaskActions>(
    { params, actionType, defaultHandler }:
      {
        params: TaskActionHelperParams<TaskActionParams[T]>, actionType: T,
        defaultHandler?: TaskActions[T],
      },
  ): Promise<TaskActionOutputs[T]> {

    const { task } = <any>params
    const module = task.module

    const handler = await this.garden.getModuleActionHandler({
      moduleType: module.type,
      actionType,
      pluginName: params.pluginName,
      defaultHandler,
    })

    const buildDependencies = await this.getBuildDependencies(module)

    const handlerParams: any = {
      ...this.commonParams(handler, <any>params.log),
      ...<object>params,
      module,
      task,
      buildDependencies,
    }

    return (<Function>handler)(handlerParams)
  }
}

const dummyLogStreamer = async ({ service, log }: GetServiceLogsParams) => {
  log.warn({
    section: service.name,
    msg: chalk.yellow(`No handler for log retrieval available for module type ${service.module.type}`),
  })
  return {}
}

const dummyPushHandler = async () => {
  return { pushed: false }
}

const dummyPublishHandler = async ({ module }) => {
  return {
    message: chalk.yellow(`No publish handler available for module type ${module.type}`),
    published: false,
  }
}

const dummyDeleteServiceHandler = async ({ module, log }: DeleteServiceParams) => {
  const msg = `No delete service handler available for module type ${module.type}`
  log.setError(msg)
  return {}
}

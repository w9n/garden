/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { TaskResults, TaskResult, Tasks, TaskOutputs } from "../task-graph"
import { ModuleVersion, NEW_MODULE_VERSION } from "../vcs/base"
import { v1 as uuidv1 } from "uuid"
import { Garden } from "../garden"
import { LogEntry } from "../logger/log-entry"
import { Module, getModuleKey } from "../types/module"
import { ModuleActionName, ServiceActionName } from "../types/plugin/plugin"
import * as Bluebird from "bluebird"
import { uniq } from "lodash"
import { PrepareEnvironmentTask } from "./prepare-environment"
import { ModuleConfig } from "../config/module"
import { InternalError } from "../exceptions"
import { ResolveModuleTask } from "./resolve-module"
import * as hashObject from "object-hash"
import { BuildTask } from "./build"
import { ResolveConfigTask } from "./resolve-config"

export class TaskDefinitionError extends Error { }

export interface TaskParams {
  garden: Garden
  log: LogEntry
  force: boolean
  version?: ModuleVersion
}

export abstract class BaseTask<ParamsType extends TaskParams = TaskParams, ResultType = any> {
  abstract type: string

  readonly concurrencyLimit?: number

  protected readonly garden: Garden
  protected readonly log: LogEntry
  readonly id: string
  readonly force: boolean
  readonly version: ModuleVersion

  readonly params: ParamsType
  private readonly paramsHash: string

  readonly _ResultType: ResultType

  constructor(params: ParamsType) {
    this.garden = params.garden
    this.log = params.log
    this.id = uuidv1() // uuidv1 is timestamp-based
    this.force = params.force
    this.version = params.version || {
      versionString: NEW_MODULE_VERSION,
      dirtyTimestamp: null,
      dependencyVersions: {},
    }
    this.paramsHash = hashObject(params)
  }

  protected abstract getName(): string

  getBaseKey(): string {
    return `${this.type}.${this.getName()}`
  }

  getKey(): string {
    return `${this.getBaseKey()}.${this.paramsHash.slice(0, 8)}`
  }

  abstract getDescription(): string

  /**
   * Resolve the specified tasks and return corresponding TaskResult objects.
   */
  protected async processTasks<T extends Tasks>(tasks: T): Promise<TaskResults<T>> {
    return this.garden.taskGraph.process(tasks, this)
  }

  /**
   * Resolve the specified tasks and return their outputs.
   */
  protected async resolveTasks<T extends Tasks>(tasks: T): Promise<TaskOutputs<T>> {
    return this.garden.taskGraph.resolve(tasks, this)
  }

  /**
   * Helper method to get the result (with the correct type) for the specified task from the dependency results.
   */
  protected getDependencyResult<T extends BaseTask>(dependencyResults: TaskResults, task: T): TaskResult<T> {
    const taskKey = task.getBaseKey()
    const result = dependencyResults[taskKey]
    if (!result) {
      throw new InternalError(`Missing expected task result: ${taskKey}`, {
        taskKey,
      })
    }
    return <TaskResult<T>>result
  }

  /**
   * Get the Module objects from the dependency results for each specified module config.
   */
  protected async getModules(dependencyResults: TaskResults, moduleConfigs: ModuleConfig[]): Promise<Module[]> {
    return Bluebird.map(moduleConfigs, async (moduleConfig) => {
      const task = new ResolveModuleTask({
        garden: this.garden,
        log: this.log,
        moduleConfig,
        version: this.version,  // the version doesn't currently matter here
        force: this.force,
      })
      const result = await this.getDependencyResult(dependencyResults, task)
      return result.output!
    })
  }

  abstract async process(dependencyResults: TaskResults): Promise<ResultType>
}

export interface ModuleTaskParams extends TaskParams {
  moduleConfig: ModuleConfig
  version: ModuleVersion
  // TODO: revisit these parameters
  fromWatch?: boolean
  hotReloadServiceNames?: string[]
}

export abstract class ModuleTask
  <ParamsType extends ModuleTaskParams = ModuleTaskParams, ResultType = any>
  extends BaseTask<ParamsType, ResultType> {

  protected moduleConfig: ModuleConfig
  protected resolveModuleTask: ResolveModuleTask

  protected fromWatch: boolean
  protected hotReloadServiceNames: string[]

  constructor(params: ParamsType) {
    super(params)

    this.moduleConfig = params.moduleConfig
    this.fromWatch = !!params.fromWatch
    this.hotReloadServiceNames = params.hotReloadServiceNames || []

    this.resolveModuleTask = new ResolveModuleTask({
      garden: this.garden,
      log: this.log,
      moduleConfig: this.moduleConfig,
      version: this.version,
      force: this.force,
    })
  }

  protected getName() {
    return getModuleKey(this.moduleConfig.name, this.moduleConfig.plugin)
  }

  /**
   * Returns the resolved config graph.
   */
  async getConfigGraph() {
    const { configGraph } = await this.resolveTasks({
      configGraph: new ResolveConfigTask({
        garden: this.garden,
        log: this.log,
        force: this.force,
      }),
    })
    return configGraph
  }

  /**
   * Return preparation tasks for every provider that this module depends on for the specified
   * action types.
   */
  protected async getProviderTasks(
    ...actions: (ModuleActionName | ServiceActionName)[]): Promise<PrepareEnvironmentTask[]> {
    const providerNames = await this.getProviderNames(...actions)

    return Bluebird.map(providerNames, async (providerName) => new PrepareEnvironmentTask({
      garden: this.garden,
      log: this.log,
      force: false,
      provider: await this.garden.getProvider(providerName),
      allowUserInput: false,
    }))
  }

  protected getBuildTask(force: boolean) {
    return new BuildTask({
      garden: this.garden,
      force,
      version: this.version,
      moduleConfig: this.moduleConfig,
      fromWatch: this.fromWatch,
      hotReloadServiceNames: this.hotReloadServiceNames,
    })
  }

  /**
   * Return a list of names of providers needed to complete the specified actions for this module.
   */
  protected async getProviderNames(...actions: (ModuleActionName | ServiceActionName)[]): Promise<string[]> {
    const handlers = await Bluebird.map(actions, async (actionType) => {
      const actionHandlers = Object.values(await this.garden.getModuleActionHandlers({
        actionType,
        moduleType: this.moduleConfig.type,
      }))
      return actionHandlers.length > 0 ? actionHandlers[actionHandlers.length - 1] : null
    })
    return uniq(handlers.filter(h => h !== null).map(h => h!["pluginName"]))
  }
}

export interface ServiceTaskParams extends ModuleTaskParams {
  serviceName: string
}

export abstract class ServiceTask
  <ParamsType extends ServiceTaskParams = ServiceTaskParams, ResultType = any>
  extends ModuleTask<ParamsType, ResultType> {

  protected readonly serviceName: string

  constructor(params: ParamsType) {
    super(params)
    this.serviceName = params.serviceName
  }

  protected getName() {
    return this.serviceName
  }
}

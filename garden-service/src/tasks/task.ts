/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import { BaseTask, ModuleTask } from "../tasks/base"
import { DeployTask } from "./deploy"
import { RunTaskResult } from "../types/plugin/outputs"
import { prepareRuntimeContext } from "../types/service"
import { ModuleTaskParams } from "./base"

export interface TaskTaskParams extends ModuleTaskParams {
  taskName: string
  forceBuild: boolean
}

export class TaskTask extends ModuleTask<TaskTaskParams, RunTaskResult> { // ... to be renamed soon.
  type = "task"

  private taskName: string
  private forceBuild: boolean

  constructor(params: TaskTaskParams) {
    super(params)
    this.taskName = params.taskName
    this.forceBuild = params.forceBuild
  }

  async getDependencies(): Promise<BaseTask[]> {
    const buildTask = this.getBuildTask(this.forceBuild)

    const dg = await this.garden.getDependencyGraph()
    const deps = dg.getDependencies("task", this.getName(), false)

    const deployTasks = deps.service.map(service => {
      return new DeployTask({
        moduleConfig: service.module.config,
        version: service.version,
        serviceName: service.name,
        log: this.log,
        garden: this.garden,
        force: false,
        forceBuild: false,
      })
    })

    const taskTasks = deps.task.map(task => {
      return new TaskTask({
        moduleConfig: task.module.config,
        taskName: task.name,
        version: task.module.version,
        log: this.log,
        garden: this.garden,
        force: false,
        forceBuild: false,
      })
    })

    return [buildTask, ...deployTasks, ...taskTasks]

  }

  protected getName() {
    return this.task.name
  }

  getDescription() {
    return `running task ${this.task.name} in module ${this.task.module.name}`
  }

  async process() {
    const task = this.task
    const module = task.module

    const log = this.garden.log.info({
      section: task.name,
      msg: "Running",
      status: "active",
    })

    // combine all dependencies for all services in the module, to be sure we have all the context we need
    const dg = await this.garden.getDependencyGraph()
    const serviceDeps = (await dg.getDependencies("task", this.getName(), false)).service
    const runtimeContext = await prepareRuntimeContext(this.garden, log, module, serviceDeps)

    let result: RunTaskResult
    try {
      result = await this.garden.actions.runTask({
        task,
        log,
        runtimeContext,
        interactive: false,
      })
    } catch (err) {
      log.setError()
      throw err
    }

    log.setSuccess({ msg: chalk.green(`Done (took ${log.getDuration(1)} sec)`), append: true })

    return result

  }

}

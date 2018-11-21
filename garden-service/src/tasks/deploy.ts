/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as Bluebird from "bluebird"
import chalk from "chalk"
import { includes } from "lodash"
import { LogEntry } from "../logger/log-entry"
import { TaskTask } from "./task"
import { ServiceTask, ServiceTaskParams } from "./base"
import { ServiceStatus, prepareRuntimeContext } from "../types/service"
import { PushTask } from "./push"
import { findByName } from "../util/util"

interface DeployTaskParams extends ServiceTaskParams {
  forceBuild: boolean
  fromWatch?: boolean
  log: LogEntry
}

export class DeployTask extends ServiceTask<DeployTaskParams, ServiceStatus> {
  type = "deploy"
  concurrencyLimit = 10

  private forceBuild: boolean

  constructor(params: DeployTaskParams) {
    super(params)
    this.forceBuild = params.forceBuild
  }

  async computeDependencies() {
    const dg = await this.garden.getDependencyGraph()

    // TODO!
    // We filter out service dependencies on services configured for hot reloading (if any)
    const graphDeps = await dg.getDependencies("service", this.getName(), false,
      (depNode) => !(depNode.type === "service" && includes(this.hotReloadServiceNames, depNode.name)))

    const servicesToDeploy = this.serviceConfig.dependencies
      .filter(s => !includes(this.hotReloadServiceNames, s))

    const deps = await Bluebird.map(servicesToDeploy, async (serviceName) => {
      const version = await this.garden.resolveModuleVersion(this.moduleConfig)

      return new DeployTask({
        garden: this.garden,
        log: this.log,
        moduleConfig: this.moduleConfig,
        version,
        serviceConfig: this.serviceConfig,
        force: false,
        forceBuild: this.forceBuild,
        fromWatch: this.fromWatch,
        hotReloadServiceNames: this.hotReloadServiceNames,
      })
    })

    if (!this.fromWatch || !includes(this.hotReloadServiceNames, this.service.name)) {
      deps.push(...graphDeps.task.map(task => {
        return new TaskTask({
          task,
          garden: this.garden,
          log: this.log,
          force: false,
          forceBuild: this.forceBuild,
        })
      }))

      deps.push(new PushTask({
        garden: this.garden,
        log: this.log,
        force: this.force,
        moduleConfig: this.moduleConfig,
        version: this.version,
        forceBuild: this.forceBuild,
      }))
    }

    deps.push(...await this.getProviderTasks("getServiceStatus", "deployService"))

    return deps
  }

  getDescription() {
    return `deploying service ${this.serviceConfig.name} (from module ${this.moduleConfig.name})`
  }

  async process(dependencyResults: TaskResults) {
    const log = this.log.info({
      section: this.serviceConfig.name,
      msg: "Checking status",
      status: "active",
    })

    const module = await this.getModule(dependencyResults)
    const service = findByName(module.services, this.serviceConfig.name)!

    // TODO: get version from build task results
    const { versionString } = this.version

    const hotReloadEnabled = includes(this.hotReloadServiceNames, this.serviceConfig.name)

    const status = await this.garden.actions.getServiceStatus({
      service,
      verifyHotReloadStatus: hotReloadEnabled ? "enabled" : "disabled",
      log,
    })

    if (
      !this.force &&
      versionString === status.version &&
      status.state === "ready"
    ) {
      // already deployed and ready
      log.setSuccess({
        msg: `Version ${versionString} already deployed`,
        append: true,
      })
      return status
    }

    log.setState(`Deploying version ${versionString}...`)

    const dependencies = await this.getResolvedServices(dependencyResults, service.config.dependencies)

    let result: ServiceStatus
    try {
      result = await this.garden.actions.deployService({
        service,
        runtimeContext: await prepareRuntimeContext(this.garden, log, module, dependencies),
        log,
        force: this.force,
        hotReload: hotReloadEnabled,
      })
    } catch (err) {
      log.setError()
      throw err
    }

    log.setSuccess({ msg: chalk.green(`Done (took ${log.getDuration(1)} sec)`), append: true })
    return result
  }
}

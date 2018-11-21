/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import { PushResult } from "../types/plugin/outputs"
import { ModuleTask, ModuleTaskParams } from "../tasks/base"

interface Params extends ModuleTaskParams {
  forceBuild: boolean
}

export class PushTask extends ModuleTask<Params, PushResult> {
  type = "push"
  concurrencyLimit = 4

  private readonly forceBuild: boolean

  constructor(params: Params) {
    super(params)
    this.forceBuild = params.forceBuild
  }

  getName() {
    return this.moduleConfig.name
  }

  getDescription() {
    return `pushing module ${this.moduleConfig.name}`
  }

  async process() {
    // Resolve dependencies.
    const { module } = await this.resolveTasks({
      module: this.resolveModuleTask,
      build: this.getBuildTask(this.forceBuild),
      providers: await this.getProviderTasks("pushModule"),
    })

    // avoid logging stuff if there is no push handler
    const defaultHandler = async () => ({ pushed: false })
    const handler = await this.garden.getModuleActionHandler({
      moduleType: module.type,
      actionType: "pushModule",
      defaultHandler,
    })

    if (handler === defaultHandler) {
      return { pushed: false }
    }

    const log = this.garden.log.info({
      section: module.name,
      msg: "Pushing",
      status: "active",
    })

    let result: PushResult
    try {
      result = await this.garden.actions.pushModule({ module, log })
    } catch (err) {
      log.setError()
      throw err
    }

    if (result.pushed) {
      log.setSuccess({ msg: chalk.green(result.message || `Ready`), append: true })
    } else if (result.message) {
      log.setWarn({ msg: result.message, append: true })
    }

    return result
  }
}

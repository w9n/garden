/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import { PublishResult } from "../types/plugin/outputs"
import { ModuleTask } from "../tasks/base"
import { ModuleTaskParams } from "./base"

interface Params extends ModuleTaskParams {
  forceBuild: boolean
}

export class PublishTask extends ModuleTask<Params, PublishResult> {
  type = "publish"

  private readonly forceBuild: boolean

  constructor(params: Params) {
    super(params)
    this.forceBuild = params.forceBuild
  }

  getDescription() {
    return `publishing module ${this.moduleConfig.name}`
  }

  async process() {
    if (!this.moduleConfig.allowPublish) {
      this.garden.log.info({
        section: this.getName(),
        msg: "Publishing disabled",
        status: "active",
      })
      return { published: false }
    }

    // Resolve dependencies.
    const { module } = await this.resolveTasks({
      module: this.resolveModuleTask,
      build: this.getBuildTask(this.forceBuild),
      providers: await this.getProviderTasks("publishModule"),
    })

    const log = this.log.info({
      section: module.name,
      msg: "Publishing",
      status: "active",
    })

    let result: PublishResult
    try {
      result = await this.garden.actions.publishModule({ module, log })
    } catch (err) {
      log.setError()
      throw err
    }

    if (result.published) {
      log.setSuccess({ msg: chalk.green(result.message || `Ready`), append: true })
    } else {
      log.setWarn({ msg: result.message, append: true })
    }

    return result
  }
}

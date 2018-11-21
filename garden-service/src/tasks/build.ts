/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import { Module } from "../types/module"
import { BuildResult } from "../types/plugin/outputs"
import { getHotReloadModuleNames } from "./helpers"
import { ModuleTask, ModuleTaskParams } from "./base"

export class BuildTask extends ModuleTask<ModuleTaskParams, BuildResult> {
  type = "build"
  concurrencyLimit = 4

  getDescription() {
    return `building ${this.getName()}`
  }

  async process() {
    const dg = await this.getConfigGraph()
    const hotReloadModuleNames = await getHotReloadModuleNames(dg, this.hotReloadServiceNames)

    // We ignore build dependencies on modules with services deployed with hot reloading
    const deps = (await dg.getDependencies("build", this.getName(), false)).build
      .filter(m => !hotReloadModuleNames.has(m.name))

    await this.processTasks([
      ...deps.map((m: Module) => {
        return new BuildTask({
          garden: this.garden,
          log: this.log,
          moduleConfig: m,
          version: m.version,
          force: this.force,
          fromWatch: this.fromWatch,
          hotReloadServiceNames: this.hotReloadServiceNames,
        })
      }),
      // TODO: move to ModuleActionTask
      ...await this.getProviderTasks("getBuildStatus", "build"),
    ])

    const module = dg.getModule(this.moduleConfig.name)

    if (!this.force && (await this.garden.actions.getBuildStatus({ log: this.log, module })).ready) {
      // this is necessary in case other modules depend on files from this one
      await this.garden.buildDir.syncDependencyProducts(module)
      return { fresh: false }
    }

    const log = this.log.info({
      section: this.getName(),
      msg: `Building version ${module.version.versionString}...`,
      status: "active",
    })

    try {
      const result = await this.garden.actions.buildModule({
        module,
        log,
      })

      log.setSuccess({ msg: chalk.green(`Done (took ${log.getDuration(1)} sec)`), append: true })
      return result
    } catch (err) {
      log.setError()
      throw err
    }
  }
}

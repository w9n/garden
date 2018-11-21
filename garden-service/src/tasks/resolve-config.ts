/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { BaseTask, TaskParams } from "./base"
import { TaskResults } from "../task-graph"
import { ResolveModuleTask } from "./resolve-module"
import * as Bluebird from "bluebird"
import { ConfigGraph } from "../config/config-graph"

/**
 * Resolves the full configuration graph for the project.
 * This is necessary to resolve any service, task or test.
 */
export class ResolveConfigTask extends BaseTask<TaskParams, ConfigGraph> {
  type = "resolve-config"

  protected getName() {
    return "*"
  }

  getDescription() {
    return `resolving configuration graph`
  }

  async getDependencies() {
    // Note: We need to resolve all modules to resolve any service.
    const configs = await this.garden.getModuleConfigs()

    return Bluebird.map(configs, async (moduleConfig) => {
      const version = await this.garden.resolveModuleVersion(moduleConfig)
      return new ResolveModuleTask({
        garden: this.garden,
        force: false,
        version,
        moduleConfig,
      })
    })
  }

  async process(dependencyResults: TaskResults) {
    const modules = await this.getResolvedModules(dependencyResults)
    return new ConfigGraph(modules)
  }
}

/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as Bluebird from "bluebird"
import chalk from "chalk"
import { Module } from "../types/module"
import { TestConfig } from "../config/test"
import { ModuleVersion } from "../vcs/base"
import { DeployTask } from "./deploy"
import { TestResult } from "../types/plugin/outputs"
import { prepareRuntimeContext } from "../types/service"
import { Garden } from "../garden"
import { ModuleTask, ModuleTaskParams } from "../tasks/base"
import { ModuleConfig } from "../config/module"
import { TaskTask } from "./task"
import { LogEntry } from "../logger/log-entry"

class TestError extends Error {
  toString() {
    return this.message
  }
}

export interface TestTaskParams extends ModuleTaskParams {
  forceBuild: boolean
  testConfig: TestConfig
}

export class TestTask extends ModuleTask<TestTaskParams, TestResult> {
  type = "test"

  private testConfig: TestConfig
  private forceBuild: boolean

  constructor(params: TestTaskParams) {
    super(params)
    this.testConfig = params.testConfig
    this.forceBuild = params.forceBuild
  }

  static async factory(initArgs: TestTaskParams): Promise<TestTask> {
    const { garden, moduleConfig, testConfig } = initArgs
    const version = await getTestVersion(garden, moduleConfig, testConfig)
    return new TestTask({ ...initArgs, version })
  }

  getName() {
    return `${this.moduleConfig.name}.${this.testConfig.name}`
  }

  getDescription() {
    return `running ${this.testConfig.name} tests in module ${this.moduleConfig.name}`
  }

  async process() {
    const dg = await this.getConfigGraph()
    const deps = dg.getDependencies("test", this.getName(), false)

    await this.processTasks({
      build: this.getBuildTask(this.forceBuild),
      deploy: deps.service.map(s => {
        return new DeployTask({
          garden: this.garden,
          log: this.log,
          moduleConfig: s.module,
          version: s.module.version,
          serviceName: s.name,
          force: false,
          forceBuild: this.forceBuild,
        })
      }),
      tasks: deps.task.map(t => {
        return new TaskTask({
          garden: this.garden,
          log: this.log,
          moduleConfig: t.module,
          version: t.module.version,
          taskName: t.name,
          force: false,
          forceBuild: this.forceBuild,
        })
      }),
      providers: await this.getProviderTasks("getTestResult", "testModule"),
    })

    const module = dg.getModule(this.moduleConfig.name)

    // find out if module has already been tested
    const testResult = await this.getTestResult(module)

    if (testResult && testResult.success) {
      const passedEntry = this.log.info({
        section: module.name,
        msg: `${this.testConfig.name} tests`,
      })
      passedEntry.setSuccess({ msg: chalk.green("Already passed"), append: true })
      return testResult
    }

    const log = this.log.info({
      section: module.name,
      msg: `Running ${this.testConfig.name} tests`,
      status: "active",
    })

    const runtimeContext = await prepareRuntimeContext(this.garden, this.log, module, deps.service)

    let result: TestResult
    try {
      result = await this.garden.actions.testModule({
        log,
        interactive: false,
        module,
        runtimeContext,
        silent: true,
        testConfig: this.testConfig,
      })
    } catch (err) {
      log.setError()
      throw err
    }
    if (result.success) {
      log.setSuccess({ msg: chalk.green(`Success`), append: true })
    } else {
      log.setError({ msg: chalk.red(`Failed!`), append: true })
      throw new TestError(result.output)
    }

    return result
  }

  private async getTestResult(module: Module) {
    if (this.force) {
      return null
    }

    return this.garden.actions.getTestResult({
      log: this.log,
      module,
      testName: this.testConfig.name,
      version: this.version,
    })
  }
}

export async function getTestTasks(
  { garden, log, moduleConfig, name, force = false, forceBuild = false }:
    { garden: Garden, log: LogEntry, moduleConfig: ModuleConfig, name?: string, force?: boolean, forceBuild?: boolean },
): Promise<TestTask[]> {
  const configs = moduleConfig.testConfigs.filter(config => !name || config.name === name)

  return Bluebird.map(configs, (config) => TestTask.factory({
    garden,
    log,
    version,
    force,
    forceBuild,
    testConfig: config,
    moduleConfig,
  }))
}

/**
 * Determine the version of the test run, based on the version of the module and each of its dependencies.
 */
async function getTestVersion(
  garden: Garden, moduleConfig: ModuleConfig, testConfig: TestConfig,
): Promise<ModuleVersion> {
  const moduleDeps = await resolveDependencyModules(moduleConfig.build.dependencies, testConfig.dependencies)
  return garden.resolveVersion(moduleConfig.name, moduleDeps.map(dep => ({ ...dep, copy: [] })))
}

/**
 * Given the provided lists of build and runtime (service/task) dependencies, return a list of all
 * modules required to satisfy those dependencies.
 */
async function resolveDependencyModules(
  buildDependencies: BuildDependencyConfig[], runtimeDependencies: string[],
): Promise<Module[]> {
  const moduleNames = buildDependencies.map(d => getModuleKey(d.name, d.plugin))
  const dg = await this.getDependencyGraph()

  const serviceNames = runtimeDependencies.filter(d => this.serviceNameIndex[d])
  const taskNames = runtimeDependencies.filter(d => this.taskNameIndex[d])

  const buildDeps = await dg.getDependenciesForMany("build", moduleNames, true)
  const serviceDeps = await dg.getDependenciesForMany("service", serviceNames, true)
  const taskDeps = await dg.getDependenciesForMany("task", taskNames, true)

  const modules = [
    ...(await this.getModules(moduleNames)),
    ...(await dg.modulesForRelations(await dg.mergeRelations(buildDeps, serviceDeps, taskDeps))),
  ]

  return sortBy(uniqByName(modules), "name")
}
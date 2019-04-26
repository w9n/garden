/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as td from "testdouble"
import * as Joi from "joi"
import { resolve, join } from "path"
import { remove, readdirSync, existsSync } from "fs-extra"
import { containerModuleSpecSchema, containerTestSchema, containerTaskSchema } from "../src/plugins/container/config"
import { testExecModule, buildExecModule, execBuildSpecSchema } from "../src/plugins/exec"
import { TaskResults } from "../src/task-graph"
import { validate, PrimitiveMap, joiArray } from "../src/config/common"
import {
  GardenPlugin,
  PluginActions,
  PluginFactory,
  ModuleActions,
  Plugins,
} from "../src/types/plugin/plugin"
import { Garden, GardenOpts } from "../src/garden"
import { ModuleConfig } from "../src/config/module"
import { mapValues, fromPairs } from "lodash"
import {
  DeleteSecretParams,
  GetSecretParams,
  ConfigureModuleParams,
  RunModuleParams,
  RunServiceParams,
  RunTaskParams,
  SetSecretParams,
} from "../src/types/plugin/params"
import { ModuleVersion } from "../src/vcs/vcs"
import { GARDEN_DIR_NAME, CONFIG_FILENAME } from "../src/constants"
import { EventBus, Events } from "../src/events"
import { ValueOf } from "../src/util/util"
import { Ignorer } from "../src/util/fs"
import { SourceConfig } from "../src/config/project"
import { BuildDir } from "../src/build-dir"
import { LogEntry } from "../src/logger/log-entry"
import { ProviderConfig } from "../src/config/provider"
import timekeeper = require("timekeeper")

export const dataDir = resolve(__dirname, "unit", "data")
export const examplesDir = resolve(__dirname, "..", "..", "examples")
export const testNow = new Date()
export const testModuleVersionString = "v-1234512345"
export const testModuleVersion: ModuleVersion = {
  versionString: testModuleVersionString,
  dependencyVersions: {},
  files: [],
}

export function getDataDir(...names: string[]) {
  return resolve(dataDir, ...names)
}

export async function profileBlock(description: string, block: () => Promise<any>) {
  const startTime = new Date().getTime()
  const result = await block()
  const executionTime = (new Date().getTime()) - startTime
  console.log(description, "took", executionTime, "ms")
  return result
}

async function runModule(params: RunModuleParams) {
  const version = await params.module.version

  return {
    moduleName: params.module.name,
    command: params.command,
    completedAt: testNow,
    output: "OK",
    version,
    startedAt: testNow,
    success: true,
  }
}

export const projectRootA = getDataDir("test-project-a")

const testModuleTestSchema = containerTestSchema
  .keys({ command: Joi.array().items(Joi.string()) })

const testModuleTaskSchema = containerTaskSchema
  .keys({ command: Joi.array().items(Joi.string()) })

export const testModuleSpecSchema = containerModuleSpecSchema
  .keys({
    build: execBuildSpecSchema,
    tests: joiArray(testModuleTestSchema),
    tasks: joiArray(testModuleTaskSchema),
  })

export async function configureTestModule({ moduleConfig }: ConfigureModuleParams) {
  moduleConfig.spec = validate(
    moduleConfig.spec,
    testModuleSpecSchema,
    { context: `test module ${moduleConfig.name}` },
  )

  moduleConfig.outputs = { foo: "bar" }

  // validate services
  moduleConfig.serviceConfigs = moduleConfig.spec.services.map(spec => ({
    name: spec.name,
    dependencies: spec.dependencies,
    outputs: spec.outputs,
    sourceModuleName: spec.sourceModuleName,
    spec,
  }))

  moduleConfig.taskConfigs = moduleConfig.spec.tasks.map(t => ({
    name: t.name,
    dependencies: t.dependencies,
    spec: t,
    timeout: t.timeout,
  }))

  moduleConfig.testConfigs = moduleConfig.spec.tests.map(t => ({
    name: t.name,
    dependencies: t.dependencies,
    spec: t,
    timeout: t.timeout,
  }))

  return moduleConfig
}

export const testPlugin: PluginFactory = (): GardenPlugin => {
  const secrets = {}

  return {
    actions: {
      async prepareEnvironment() {
        return {}
      },

      async setSecret({ key, value }: SetSecretParams) {
        secrets[key] = value
        return {}
      },

      async getSecret({ key }: GetSecretParams) {
        return { value: secrets[key] || null }
      },

      async deleteSecret({ key }: DeleteSecretParams) {
        if (secrets[key]) {
          delete secrets[key]
          return { found: true }
        } else {
          return { found: false }
        }
      },
    },
    moduleActions: {
      test: {
        testModule: testExecModule,
        configure: configureTestModule,
        build: buildExecModule,
        runModule,

        async getServiceStatus() { return {} },
        async deployService() { return {} },

        async runService(
          { ctx, service, interactive, runtimeContext, timeout, log }: RunServiceParams,
        ) {
          return runModule({
            ctx,
            log,
            module: service.module,
            command: [service.name],
            interactive,
            runtimeContext,
            timeout,
          })
        },

        async runTask(
          { ctx, task, interactive, runtimeContext, log }: RunTaskParams,
        ) {
          const result = await runModule({
            ctx,
            interactive,
            log,
            runtimeContext,
            module: task.module,
            command: task.spec.command || [],
            ignoreError: false,
            timeout: task.spec.timeout || 9999,
          })

          return {
            ...result,
            taskName: task.name,
          }
        },

      },
    },
  }
}

export const testPluginB: PluginFactory = async (params) => {
  const plugin = await testPlugin(params)
  plugin.moduleActions = {
    test: plugin.moduleActions!.test,
  }
  return plugin
}

export const testPluginC: PluginFactory = async (params) => {
  const plugin = await testPlugin(params)
  plugin.moduleActions = {
    "test-c": plugin.moduleActions!.test,
  }
  return plugin
}

const defaultModuleConfig: ModuleConfig = {
  apiVersion: "garden.io/v0",
  type: "test",
  name: "test",
  path: "bla",
  allowPublish: false,
  build: { dependencies: [] },
  outputs: {},
  spec: {
    services: [
      {
        name: "test-service",
        dependencies: [],
      },
    ],
  },
  serviceConfigs: [
    {
      name: "test-service",
      dependencies: [],
      outputs: {},
      spec: {},
    },
  ],
  testConfigs: [],
  taskConfigs: [],
}

export const makeTestModule = (params: Partial<ModuleConfig> = {}) => {
  return { ...defaultModuleConfig, ...params }
}

interface EventLogEntry {
  name: string
  payload: ValueOf<Events>
}

/**
 * Used for test Garden instances, to log emitted events.
 */
class TestEventBus extends EventBus {
  public eventLog: EventLogEntry[]

  constructor(log: LogEntry) {
    super(log)
    this.eventLog = []
  }

  emit<T extends keyof Events>(name: T, payload: Events[T]) {
    this.eventLog.push({ name, payload })
    return super.emit(name, payload)
  }

  clearLog() {
    this.eventLog = []
  }
}

export class TestGarden extends Garden {
  events: TestEventBus

  constructor(
    public readonly projectRoot: string,
    public readonly projectName: string,
    public readonly environmentName: string,
    public readonly variables: PrimitiveMap,
    public readonly projectSources: SourceConfig[] = [],
    public readonly buildDir: BuildDir,
    public readonly ignorer: Ignorer,
    public readonly opts: GardenOpts,
    plugins: Plugins,
    providerConfigs: ProviderConfig[],
  ) {
    super(
      projectRoot, projectName, environmentName, variables, projectSources,
      buildDir, ignorer, opts, plugins, providerConfigs,
    )
    this.events = new TestEventBus(this.log)
  }
}

export const makeTestGarden = async (projectRoot: string, extraPlugins: Plugins = {}): Promise<TestGarden> => {
  const testPlugins = {
    "test-plugin": testPlugin,
    "test-plugin-b": testPluginB,
    "test-plugin-c": testPluginC,
  }
  const plugins = { ...testPlugins, ...extraPlugins }

  return TestGarden.factory(projectRoot, { plugins })
}

export const makeTestGardenA = async (extraPlugins: Plugins = {}) => {
  return makeTestGarden(projectRootA, extraPlugins)
}

export function stubAction<T extends keyof PluginActions>(
  garden: Garden, pluginName: string, type: T, handler?: PluginActions[T],
) {
  if (handler) {
    handler["pluginName"] = pluginName
  }
  return td.replace(garden["actionHandlers"][type], pluginName, handler)
}

export function stubModuleAction<T extends keyof ModuleActions<any>>(
  garden: Garden, moduleType: string, pluginName: string, actionType: T, handler: ModuleActions<any>[T],
) {
  handler["actionType"] = actionType
  handler["pluginName"] = pluginName
  handler["moduleType"] = moduleType
  return td.replace(garden["moduleActionHandlers"][actionType][moduleType], pluginName, handler)
}

export async function expectError(fn: Function, typeOrCallback: string | ((err: any) => void)) {
  try {
    await fn()
  } catch (err) {
    if (typeof typeOrCallback === "function") {
      return typeOrCallback(err)
    } else {
      if (!err.type) {
        const newError = Error(`Expected GardenError with type ${typeOrCallback}, got: ${err}`)
        newError.stack = err.stack
        throw newError
      }
      if (err.type !== typeOrCallback) {
        const newError = Error(`Expected ${typeOrCallback} error, got: ${err.type} error`)
        newError.stack = err.stack
        throw newError
      }
    }
    return
  }

  if (typeof typeOrCallback === "string") {
    throw new Error(`Expected ${typeOrCallback} error (got no error)`)
  } else {
    throw new Error(`Expected error (got no error)`)
  }
}

export function taskResultOutputs(results: TaskResults) {
  return mapValues(results, r => r.output)
}

export const cleanProject = async (projectRoot: string) => {
  return remove(join(projectRoot, GARDEN_DIR_NAME))
}

export function stubGitCli(garden: Garden) {
  td.replace(garden.vcs, "gitCli", () => async () => "")
}

/**
 * Prevents git cloning. Use if creating a Garden instance with test-project-ext-module-sources
 * or test-project-ext-project-sources as project root.
 */
export function stubExtSources(garden: Garden) {
  stubGitCli(garden)
  const getRemoteSourcesDirname = td.replace(garden.vcs, "getRemoteSourcesDirname")

  td.when(getRemoteSourcesDirname("module")).thenReturn(join("mock-dot-garden", "sources", "module"))
  td.when(getRemoteSourcesDirname("project")).thenReturn(join("mock-dot-garden", "sources", "project"))
}

export function getExampleProjects() {
  const names = readdirSync(examplesDir).filter(n => existsSync(join(examplesDir, n, CONFIG_FILENAME)))
  return fromPairs(names.map(n => [n, join(examplesDir, n)]))
}

export function freezeTime(date?: Date) {
  if (!date) {
    date = new Date()
  }
  timekeeper.freeze(date)
  return date
}

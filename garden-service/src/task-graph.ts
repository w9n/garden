/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import * as yaml from "js-yaml"
import hasAnsi = require("has-ansi")
import { padEnd, flatten, mapValues, sortBy } from "lodash"
import { BaseTask } from "./tasks/base"
import { LogEntry } from "./logger/log-entry"
import { toGardenError, GardenBaseError, InternalError } from "./exceptions"
import { Garden } from "./garden"
import { isArray, isObject } from "util"
import { deepMap } from "./util/util"

// Thrown when a task fails to process.
class TaskError extends GardenBaseError {
  type = "task"
}

export interface TaskResult<T extends BaseTask = BaseTask> {
  baseKey: string
  key: string
  id: string
  params: T["params"]
  type: string
  description: string
  output?: T["_ResultType"]
  dependencyResults: TaskResults
  error?: Error
  startedAt: Date
  completedAt: Date
}

export type Tasks = BaseTask | BaseTask[] | { [key: string]: Tasks }

type TaskResultMap<T = any> = {
  [K in keyof T]: TaskResults<T[K]>
}

export type TaskResults<T = any> =
  T extends BaseTask ? TaskResult<T> :
  T extends BaseTask[] ? TaskResultMap<T> :  // As of TypeScript 3.1, this also works for arrays
  TaskResultMap<T>

type TaskOutputMap<T = any> = {
  [K in keyof T]: TaskOutputs<T[K]>
}

export type TaskOutputs<T = any> =
  T extends BaseTask<infer U, infer V> ? V :
  T extends BaseTask<infer W, infer X>[] ? X[] :  // As of TypeScript 3.1, this also works for arrays
  TaskOutputMap<T>

const DEFAULT_MAX_CONCURRENCY = 100
const MAX_CACHE_SIZE = 1000
const CACHE_CLEANUP_RATIO = 0.8

/**
 * The TaskGraph manages the execution of tasks for Garden commands. The graph de-duplicates tasks,
 * executes them in dependency order, applies concurrency limits, and caches results. This means that
 * multiple commands or requests can resolve tasks concurrently without duplicating work or overloading
 * the service.
 *
 * The graph is used via the `process()` and `resolve()` methods (see below for details). The class also
 * emits `taskComplete` and `taskError` events, which may be useful for logging, testing and debugging.
 */
export class TaskGraph {
  private roots: TaskNodeMap
  private index: TaskNodeMap

  private inProgress: TaskNodeMap
  private logEntryMap: LogEntryMap

  /**
   * A given task instance (uniquely identified by its key) should always return the same
   * list of dependencies (by baseKey) from its getDependencies method.
   */
  private taskDependencyCache: { [key: string]: Set<string> } // sets of baseKeys

  private resultCache: ResultCache

  constructor(
    private garden: Garden, private log: LogEntry, private readonly concurrencyLimit = DEFAULT_MAX_CONCURRENCY,
  ) {
    this.roots = new TaskNodeMap()
    this.index = new TaskNodeMap()
    this.inProgress = new TaskNodeMap()
    this.taskDependencyCache = {}
    this.resultCache = new ResultCache()
    this.logEntryMap = {}
  }

  /**
   * Process the given tasks, specified as an object with BaseTask objects as the values, or an array of Tasks.
   *
   * The shape of the input object is quite flexible, and you can even provide an object with arrays of Tasks as
   * values, or the other way around. The returned object will have the same shape as the input object,
   * with TaskResult objects in place of BaseTask objects will be returned once all tasks
   * successfully complete, or a TaskError thrown when any of the tasks fail.
   *
   * IMPORTANT: When calling from within a task's process() method, you must take care to specify the calling
   * task as the `parent` task, to avoid potential deadlocks due to concurrency limits.
   *
   * Use the resolve() method to get the task outputs directly, instead of the full TaskResult objects.
   */
  async process<T extends Tasks>(tasks: T, parent?: BaseTask): Promise<TaskResults<T>> {
    const nodes: { [key: string]: TaskNode } = {}
    const results = {}

    deepMap(tasks, task => {
      nodes[task.getKey()] = new TaskNode(task, parent)
    })

    return new Promise<TaskResults<T>>((resolve, reject) => {
      this.garden.events.on("taskComplete", (result: TaskResult) => {
        if (result.key in nodes) {
          // Add to output object.
          results[result.key] = result
        }

        // Resolve when all our expected tasks are completed.
        if (Object.keys(results).length === Object.keys(nodes).length) {
          resolve(mapTasksToResults(tasks, results))
        }
      })

      this.garden.events.on("taskError", (result: TaskResult) => {
        if (result.key in nodes) {
          reject(new TaskError(`Failed processing task ${result.key}`, {
            result,
            results,
          }))
        }
      })

      // This needs to happen after the event handlers are registered, because results may be emitted instantly
      for (const node of Object.values(nodes)) {
        this.addNode(node)
      }
    })
  }

  /**
   * The same as process() except returns the task outputs directly, instead of the full TaskResult objects
   */
  async resolve<T extends Tasks>(tasks: T, parent?: BaseTask): Promise<TaskOutputs<T>> {
    const results = await this.process(tasks, parent)
    return <TaskOutputs<T>>deepMap(results, r => r.output)
  }

  /**
   * Rebuilds the dependency relationships between the TaskNodes in this.index, and updates this.roots accordingly.
   */
  private async rebuild() {
    const taskNodes = this.index.getNodes()

    // this.taskDependencyCache will already have been populated at this point (happens in addTaskInternal).
    for (const node of taskNodes) {
      /**
       * We set the list of dependency nodes to the intersection of the set of nodes in this.index with
       * the node's task's dependencies (from configuration).
       */
      node.clear()
      const taskDeps = this.taskDependencyCache[node.key] || new Set()
      node.setDependencies(taskNodes.filter(n => taskDeps.has(n.baseKey)))
    }

    const newRootNodes = taskNodes.filter(n => n.getDependencies().length === 0)
    this.roots.clear()
    this.roots.setNodes(newRootNodes)
  }

  private async addTaskInternal(task: BaseTask) {
    this.garden.events.emit("taskPending", {
      addedAt: new Date(),
      key: task.getKey(),
      version: task.version,
    })
    await this.addNodeWithDependencies(task)
    await this.rebuild()
  }

  private getNode(task: BaseTask): TaskNode | null {
    const key = task.getKey()
    const baseKey = task.getBaseKey()
    const existing = this.index.getNodes()
      .filter(n => n.getBaseKey() === baseKey && n.getKey() !== key)
      .reverse()[0]

    if (existing) {
      // A task with the same baseKey is already pending.
      return existing
    } else {
      const cachedResultExists = !!this.resultCache.get(task.getBaseKey(), task.version.versionString)
      if (cachedResultExists && !task.force) {
        // No need to add task or its dependencies.
        return null
      } else {
        return new TaskNode((task))
      }
    }
  }

  private addNode(node: TaskNode) {
    const existing = this.index.getNode(node.key)
    if (existing) {
      return
    }

    const predecessor = this.getPredecessor(node)

    if (predecessor) {
      /*
        predecessor is already in the graph, having the same baseKey as task,
        but a different key (see the getPredecessor method below).
      */
      if (this.inProgress.contains(predecessor)) {
        this.index.addNode(node)
        /*
          We transition
            [dependencies] > predecessor > [dependants]
          to
            [dependencies] > predecessor > node > [dependants]
         */
        this.inherit(predecessor, node)
        return
      } else {
        // TODO: review this logic - does this really make sense?
        node = predecessor // No need to add a new TaskNode.
      }
    }

    const result = this.resultCache.get(node.key)
    // should we emit a taskError if we find an error result in the cache?
    if (!node.task.force && result && !result.error) {
      this.garden.events.emit("taskComplete", result)
      return
    }

    this.index.addNode(node)

    for (const d of node.getDependencies()) {
      const dependency = this.getPredecessor(d) || d
      const depResult = this.resultCache.get(dependency.key)

      if (!dependency.task.force && depResult) {
        node.removeDependency(d)
        continue
      }

      this.addNode(dependency)
      dependency.addDependant(node)
    }

    if (node.getDependencies().length === 0) {
      this.roots.addNode(node)
    }

    this.loop()
  }

  private addNode(task: BaseTask): TaskNode | null {
    const node = this.getNode(task)
    if (node) {
      this.index.addNode(node)
    }
    return node
  }

  /**
   * The main loop. Keeps processing while there are available tasks (i.e. without pending dependencies),
   * and makes sure concurrency targets are respected.
   * The loop is automatically started/restarted whenever a task is added, is finished or fails.
   */
  private loop() {
    this.log.silly("")
    this.log.silly("TaskGraph: this.index before processing")
    this.log.silly("---------------------------------------")
    this.log.silly(yaml.safeDump(this.index.inspect(), { noRefs: true, skipInvalid: true }))

    if (this.index.length === 0) {
      // No tasks to process at this time.
      this.logEntryMap.counter && this.logEntryMap.counter.setDone({ symbol: "info" })
      this.logEntryMap = {}
      this.garden.events.emit("taskGraphComplete", { completedAt: new Date() })
      return
    }

    this.garden.events.emit("taskGraphProcessing", { startedAt: new Date() })

    this.initLogging()

    await this.rebuild()

    const batch: TaskNode[] = []

    for (const node of this.roots.getNodes()) {
      // Make sure we don't pass the global concurrency limit.
      if (this.inProgress.length >= this.concurrencyLimit) {
        return
      }

      // Ignore tasks that are already in progress.
      if (this.inProgress.contains(node)) {
        continue
      }

      // If configured, make sure we don't pass the per-task-type concurrency limit,
      // *except* when being called from a parent task with the same type (because otherwise we could
      // run into deadlocks).
      if (node.task.concurrencyLimit && !(node.parent && node.parent.type === node.type)) {
        const inProgressByType = this.inProgress.getNodes()
          .filter(n => n.type === node.type)

        if (inProgressByType.length >= node.task.concurrencyLimit) {
          continue
        }
      }

      this.inProgress.addNode(node)
      batch.push(node)
    }

    batch.map(node => this.processTask(node))
  }

  private processTask(node: TaskNode) {
    const type = node.type
    const baseKey = node.baseKey
    const key = node.key
    const id = node.id
    const description = node.getDescription()
    const startedAt = new Date()
    const dependencyKeys = node.getDependencies().map(dep => dep.key)

    this.logTask(node)
    this.logEntryMap.inProgress.setState(inProgressToStr(this.inProgress.getNodes()))

    const result: TaskResult = {
      type,
      baseKey,
      key,
      id,
      description,
      params: node.task.params,
      startedAt,
      dependencyResults: this.resultCache.pick(dependencyKeys),
      completedAt: startedAt,   // This is updated before emitting the result.
    }

    node.task.process(result.dependencyResults)
      .then((output) => {
        result.output = output
        result.completedAt = new Date()
        this.garden.events.emit("taskComplete", result)
      })
      .catch((error) => {
        result.error = error
        result.completedAt = new Date()
        this.logTaskError(node, error)
        this.cancelDependants(node)
        this.garden.events.emit("taskError", result)
      })
      .finally(() => {
        this.resultCache.put(result)
        this.completeTask(node, !result.error)
        this.loop()
      })

    return result
  }

  private completeTask(node: TaskNode, success: boolean) {
    if (node.getDependencies().length > 0) {
      throw new InternalError(`Task ${node.key} still has unprocessed dependencies`, { node })
    }

    this.remove(node)
    this.logTaskComplete(node, success)
  }

  private addNodeWithDependencies(task: BaseTask) {
    const node = this.addNode(task)

    if (node) {
      const depTasks = await node.task.getDependencies()
      this.taskDependencyCache[node.getKey()] = new Set(depTasks.map(d => d.getBaseKey()))
      for (const dep of depTasks) {
        await this.addNodeWithDependencies(dep)
      }
    }
  }

  private remove(node: TaskNode) {
    this.index.removeNode(node)
    this.inProgress.removeNode(node)
  }

  // Recursively remove node's dependants, without removing node.
  private async cancelDependants(node: TaskNode) {
    for (const dependant of this.getDependants(node)) {
      this.logTaskComplete(dependant, false)
      this.remove(dependant)
    }
    await this.rebuild()
  }

  private getDependants(node: TaskNode): TaskNode[] {
    const dependants = this.index.getNodes().filter(n => n.getDependencies()
      .find(d => d.getBaseKey() === node.getBaseKey()))
    return dependants.concat(flatten(dependants.map(d => this.getDependants(d))))
  }

  // Logging
  private logTask(node: TaskNode) {
    const entry = this.log.debug({
      section: "tasks",
      msg: `Processing task ${taskStyle(node.key)}`,
      status: "active",
    })
    this.logEntryMap[node.key] = entry
  }

  private logTaskComplete(node: TaskNode, success: boolean) {
    const entry = this.logEntryMap[node.key]
    if (entry) {
      success ? entry.setSuccess() : entry.setError()
    }
    this.logEntryMap.counter.setState(remainingTasksToStr(this.index.length))
  }

  private initLogging() {
    if (!Object.keys(this.logEntryMap).length) {
      const header = this.log.debug("Processing tasks...")
      const counter = this.log.debug({
        msg: remainingTasksToStr(this.index.length),
        status: "active",
      })
      const inProgress = this.log.debug(inProgressToStr(this.inProgress.getNodes()))
      this.logEntryMap = {
        ...this.logEntryMap,
        header,
        counter,
        inProgress,
      }
    }
  }

  private logTaskError(node: TaskNode, err) {
    const divider = padEnd("", 80, "—")
    const error = toGardenError(err)
    const errorMessage = error.message.trim()

    const msg =
      chalk.red(`\nFailed ${node.getDescription()}. Here is the output:\n${divider}\n`) +
      (hasAnsi(errorMessage) ? errorMessage : chalk.red(errorMessage)) +
      chalk.red(`\n${divider}\n`)

    this.log.error({ msg, error })
  }
}

class TaskNodeMap {
  // Map is used here to facilitate in-order traversal.
  index: Map<string, TaskNode>
  length: number

  constructor() {
    this.index = new Map()
    this.length = 0
  }

  getNode(key: string) {
    return this.index.get(key)
  }

  addNode(node: TaskNode): void {
    const indexKey = node.key

    if (!this.index.get(indexKey)) {
      this.index.set(indexKey, node)
      this.length++
    }
  }

  removeNode(node: TaskNode): void {
    if (this.index.delete(node.key)) {
      this.length--
    }
  }

  setNodes(nodes: TaskNode[]): void {
    for (const node of nodes) {
      this.addNode(node)
    }
  }

  getNodes(): TaskNode[] {
    return Array.from(this.index.values())
  }

  contains(node: TaskNode): boolean {
    return this.index.has(node.key)
  }

  clear() {
    this.index.clear()
    this.length = 0
  }

  // For testing/debugging purposes
  inspect(): object {
    const out = {}
    this.index.forEach((node, key) => {
      out[key] = node.inspect()
    })
    return out
  }

}

class TaskNode {
  readonly type: string
  readonly baseKey: string
  readonly key: string
  readonly id: string

  private dependencies: TaskNodeMap

  constructor(public readonly task: BaseTask, public readonly parent?: BaseTask) {
    this.type = task.type
    this.task = task
    this.dependencies = new TaskNodeMap()
    this.baseKey = task.getBaseKey()
    this.key = getIndexKey(this.task)
    this.id = task.id
  }

  clear() {
    this.dependencies.clear()
  }

  setDependencies(nodes: TaskNode[]) {
    for (const node of nodes) {
      this.dependencies.addNode(node)
    }
  }

  getDependencies() {
    return this.remainingDependencies.getNodes()
  }

  getDescription() {
    return this.task.getDescription()
  }

  // For testing/debugging purposes
  inspect(): object {
    return {
      key: this.key,
      dependencies: this.getDependencies().map(d => d.inspect()),
    }
  }
}

class ResultCache {
  private cache: { [key: string]: TaskResult }
  private length: number

  constructor() {
    this.cache = {}
    this.length = 0
  }

  put(result: TaskResult): void {
    this.cache[result.key] = result

    if (++this.length >= MAX_CACHE_SIZE) {
      this.cleanup()
    }
  }

  get(key: string): TaskResult | null {
    const r = this.cache[key]
    return (r && r.key === key && !r.error) ? r : null
  }

  pick(keys: string[]): TaskResults<any> {
    const results = {}

    for (const key of keys) {
      const cachedResult = this.get(key)
      if (cachedResult) {
        results[key] = cachedResult
      }
    }

    return results
  }

  cleanup() {
    // Clean up 80% of the cached results, leaving the newest 20%.
    const cleanupCount = Math.floor(MAX_CACHE_SIZE * CACHE_CLEANUP_RATIO)
    const expired = sortBy(Object.values(this.cache), "completedAt").slice(cleanupCount)

    for (const result of expired) {
      delete this.cache[result.key]
    }
  }
}

interface LogEntryMap { [key: string]: LogEntry }

const taskStyle = chalk.cyan.bold

function inProgressToStr(nodes) {
  return `Currently in progress [${nodes.map(n => taskStyle(n.getKey())).join(", ")}]`
}

function remainingTasksToStr(num) {
  const style = num === 0 ? chalk.green : chalk.yellow
  return `Remaining tasks ${style.bold(String(num))}`
}

function mapTasksToResults<T>(t: T, results: { [key: string]: TaskResult }): TaskResults<T> {
  // FIXME: the typing stuff here is a little tricky but we should be able to get rid of the any cast
  if (t instanceof BaseTask) {
    return <any>results[t.getKey()]
  } else if (isArray(t)) {
    return <any>t.map(item => mapTasksToResults(item, results))
  } else if (isObject(t)) {
    return <any>mapValues(<any>t, item => mapTasksToResults(item, results))
  } else {
    // The compiler should catch this, just adding here for completeness
    throw new InternalError(`Unexpected object type: ${typeof t}`, { t })
  }
}

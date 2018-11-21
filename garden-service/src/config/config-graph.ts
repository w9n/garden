/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { flatten, pick, uniq } from "lodash"
import { BuildDependencyConfig } from "./module"
import { Module, getModuleKey } from "../types/module"
import { Service, serviceFromConfig } from "../types/service"
import { Task, taskFromConfig } from "../types/task"
import { TestConfig } from "./test"
import { uniqByName, pickKeys } from "../util/util"
import { ConfigurationError } from "../exceptions"
import { TaskConfig } from "./task"
import { ServiceConfig } from "./service"
import deline = require("deline")

export type ConfigGraphNodeType = "build" | "service" | "task" | "test"

// The primary output type (for dependencies and dependants).
export type DependencyRelations = {
  build: Module[],
  service: Service[],
  task: Task[],
  test: TestConfig[],
}

type DependencyRelationNames = {
  build: string[],
  service: string[],
  task: string[],
  test: string[],
}

export type DependencyRelationFilterFn = (node: ConfigGraphNode) => boolean

/**
 * A graph data structure that facilitates querying (recursive or non-recursive) of the project's dependency and
 * dependant relationships.
 */
export class ConfigGraph {
  private index: { [key: string]: ConfigGraphNode }

  private moduleMap: { [key: string]: Module }
  private serviceMap: { [key: string]: Service }
  private taskMap: { [key: string]: Task }
  private testConfigMap: { [key: string]: TestConfig }
  private testConfigModuleMap: { [key: string]: Module }

  constructor(modules: Module[]) {
    this.index = {}

    this.moduleMap = {}
    this.serviceMap = {}
    this.taskMap = {}
    this.testConfigMap = {}
    this.testConfigModuleMap = {}

    for (const module of modules) {
      const moduleKey = this.keyForModule(module)

      this.moduleMap[moduleKey] = module

      // Build dependencies
      const buildNode = this.getNode("build", moduleKey, moduleKey)
      for (const buildDep of module.build.dependencies) {
        const buildDepKey = getModuleKey(buildDep.name, buildDep.plugin)
        this.addRelation(buildNode, "build", buildDepKey, buildDepKey)
      }

      module.serviceConfigs.map(config => this.addService(module, moduleKey, config))
      module.taskConfigs.map(config => this.addTask(module, moduleKey, config))
      module.testConfigs.map(config => this.addTest(module, moduleKey, config))
    }
  }

  // Convenience method used in the constructor above.
  private keyForModule(module: Module | BuildDependencyConfig) {
    return getModuleKey(module.name, module.plugin)
  }

  private addService(module: Module, moduleKey: string, serviceConfig: ServiceConfig) {
    const name = serviceConfig.name

    if (this.serviceMap[name]) {
      const moduleA = this.serviceMap[name].module.name
      const moduleB = module.name

      throw new ConfigurationError(
        `Service names must be unique - ${name} is declared multiple times ` +
        `(in '${moduleA}' and '${moduleB}')`,
        {
          serviceName: name,
          moduleA,
          moduleB,
        },
      )
    }

    this.serviceMap[name] = serviceFromConfig(module, serviceConfig)

    const serviceNode = this.getNode("service", serviceConfig.name, moduleKey)
    this.addRelation(serviceNode, "build", moduleKey, moduleKey)

    for (const depName of serviceConfig.dependencies) {
      if (this.serviceMap[depName]) {
        this.addRelation(serviceNode, "service", depName, this.keyForModule(this.serviceMap[depName].module))
      } else {
        this.addRelation(serviceNode, "task", depName, this.keyForModule(this.taskMap[depName].module))
      }
    }
  }

  private addTask(module: Module, moduleKey: string, taskConfig: TaskConfig) {
    const taskName = taskConfig.name

    if (this.serviceMap[taskName]) {
      throw new ConfigurationError(deline`
        Service and task names must be mutually unique - the task name ${taskName} (declared in
        '${module.name}') is also declared as a service name in '${this.serviceMap[taskName].module.name}'`,
        {
          conflictingName: taskName,
          taskConfig,
          conflictingService: this.serviceMap[taskName],
        })
    }

    if (this.taskMap[taskName]) {
      throw new ConfigurationError(deline`
        Task names must be unique - the task name ${taskName} is declared multiple times (in
        '${this.taskMap[taskName].module.name}' and '${module.name}')`,
        {
          taskName,
          taskConfig,
          conflictingTask: this.taskMap[taskName],
        })
    }

    this.taskMap[taskName] = taskFromConfig(module, taskConfig)

    const taskNode = this.getNode("task", taskConfig.name, moduleKey)
    this.addRelation(taskNode, "build", moduleKey, moduleKey)

    for (const depName of taskConfig.dependencies) {
      if (this.serviceMap[depName]) {
        this.addRelation(taskNode, "service", depName, this.keyForModule(this.serviceMap[depName].module))
      } else {
        this.addRelation(taskNode, "task", depName, this.keyForModule(this.taskMap[depName].module))
      }
    }
  }

  private addTest(module: Module, moduleKey: string, testConfig: TestConfig) {
    const testConfigName = `${module.name}.${testConfig.name}`

    this.testConfigMap[testConfigName] = testConfig
    this.testConfigModuleMap[testConfigName] = module

    const testNode = this.getNode("test", testConfigName, moduleKey)
    this.addRelation(testNode, "build", moduleKey, moduleKey)

    for (const depName of testConfig.dependencies) {
      if (this.serviceMap[depName]) {
        this.addRelation(testNode, "service", depName, this.keyForModule(this.serviceMap[depName].module))
      } else {
        this.addRelation(testNode, "task", depName, this.keyForModule(this.taskMap[depName].module))
      }
    }
  }

  /**
   * Returns all modules that are registered in this context, or the ones specified.
   * Throws if one or more specified modules are missing.
   */
  getModules(names?: string[]): Module[] {
    return Object.values(names ? pickKeys(this.moduleMap, names, "build") : this.moduleMap)
  }

  /**
   * Returns the specified module. Throws error if it is missing.
   */
  getModule(name: string): Module {
    return this.getModules([name])[0]
  }

  /**
   * Returns all services that are registered in this context, or the ones specified.
   * Throws if one or more specified services are missing.
   */
  getServices(names?: string[]): Service[] {
    return Object.values(names ? pickKeys(this.serviceMap, names, "service") : this.serviceMap)
  }

  /**
   * Returns the specified service. Throws error if it is missing.
   */
  getService(name: string): Service {
    return this.getServices([name])[0]
  }

  /*
   * Returns all tasks that are registered in this context, or the ones specified.
   * Throws if one or more specified tasks are missing.
   */
  getTasks(names?: string[]): Task[] {
    return Object.values(names ? pickKeys(this.taskMap, names, "task") : this.taskMap)
  }

  /**
   * Returns the specified task. Throws error if it is missing.
   */
  getTask(name: string): Task {
    return this.getTasks([name])[0]
  }

  /*
   * If filterFn is provided to any of the methods below that accept it, matching nodes
   * (and their dependencies/dependants, if recursive = true) are ignored.
   */

  /**
   * Returns the set union of modules with the set union of their dependants (across all dependency types, recursively).
   */
  withDependantModules(modules: Module[], filterFn?: DependencyRelationFilterFn): Module[] {
    const dependants = flatten(modules.map(m => this.getDependantsForModule(m, filterFn)))
    // We call getModules to ensure that the returned modules have up-to-date versions.
    const dependantModules = this.modulesForRelations(this.mergeRelations(...dependants))

    return this.getModules(uniq(modules.concat(dependantModules).map(m => m.name)))
  }

  /**
   * Returns all build and runtime dependants of module and its services & tasks (recursively).
   */
  getDependantsForModule(module: Module, filterFn?: DependencyRelationFilterFn): DependencyRelations {
    const runtimeDependencies = uniq(module.serviceDependencyNames.concat(module.taskDependencyNames))
    const serviceNames = runtimeDependencies.filter(d => this.serviceMap[d])
    const taskNames = runtimeDependencies.filter(d => this.taskMap[d])

    return this.mergeRelations(
      this.getDependants("build", module.name, true, filterFn),
      this.getDependantsForMany("service", serviceNames, true, filterFn),
      this.getDependantsForMany("task", taskNames, true, filterFn),
    )
  }

  /**
   * Returns all dependencies of a node in ConfigGraph. As noted above, each ConfigGraphNodeType corresponds
   * to a Task class (e.g. BuildTask, DeployTask, ...), and name corresponds to the value returned by its getName
   * instance method.
   *
   * If recursive = true, also includes those dependencies' dependencies, etc.
   */
  getDependencies(
    nodeType: ConfigGraphNodeType, name: string, recursive: boolean, filterFn?: DependencyRelationFilterFn,
  ): DependencyRelations {
    return this.toRelations(this.getDependencyNodes(nodeType, name, recursive, filterFn))
  }

  /**
   * Returns all dependants of a node in ConfigGraph. As noted above, each ConfigGraphNodeType corresponds
   * to a Task class (e.g. BuildTask, DeployTask, ...), and name corresponds to the value returned by its getName
   * instance method.
   *
   * If recursive = true, also includes those dependants' dependants, etc.
   */
  getDependants(
    nodeType: ConfigGraphNodeType, name: string, recursive: boolean, filterFn?: DependencyRelationFilterFn,
  ): DependencyRelations {
    return this.toRelations(this.getDependantNodes(nodeType, name, recursive, filterFn))
  }

  /**
   * Same as getDependencies above, but returns the set union of the dependencies of the nodes in the graph
   * having type = nodeType and name = name (computed recursively or shallowly for all).
   */
  getDependenciesForMany(
    nodeType: ConfigGraphNodeType, names: string[], recursive: boolean, filterFn?: DependencyRelationFilterFn,
  ): DependencyRelations {
    return this.toRelations(flatten(
      names.map(name => this.getDependencyNodes(nodeType, name, recursive, filterFn))))
  }

  /**
   * Same as getDependants above, but returns the set union of the dependants of the nodes in the graph
   * having type = nodeType and name = name (computed recursively or shallowly for all).
   */
  getDependantsForMany(
    nodeType: ConfigGraphNodeType, names: string[], recursive: boolean, filterFn?: DependencyRelationFilterFn,
  ): DependencyRelations {
    return this.toRelations(flatten(
      names.map(name => this.getDependantNodes(nodeType, name, recursive, filterFn))))
  }

  /**
   * Returns the set union for each node type across relationArr (i.e. concatenates and deduplicates for each key).
   */
  mergeRelations(...relationArr: DependencyRelations[]): DependencyRelations {
    const names = {}
    for (const type of ["build", "service", "task", "test"]) {
      names[type] = uniqByName(flatten(relationArr.map(r => r[type]))).map(r => r.name)
    }

    return this.relationsFromNames({
      build: names["build"],
      service: names["service"],
      task: names["task"],
      test: names["test"],
    })
  }

  /**
   * Returns the (unique by name) list of modules represented in relations.
   */
  modulesForRelations(relations: DependencyRelations): Module[] {
    return uniq(flatten([
      relations.build,
      relations.service.map(s => s.module),
      relations.task.map(w => w.module),
      relations.test.map(t => this.testConfigModuleMap[t.name]),
    ]))
  }

  private toRelations(nodes): DependencyRelations {
    return this.relationsFromNames({
      build: this.uniqueNames(nodes, "build"),
      service: this.uniqueNames(nodes, "service"),
      task: this.uniqueNames(nodes, "task"),
      test: this.uniqueNames(nodes, "test"),
    })
  }

  private relationsFromNames(names: DependencyRelationNames): DependencyRelations {
    return {
      build: this.getModules(names.build),
      service: this.getServices(names.service),
      task: this.getTasks(names.task),
      test: Object.values(pick(this.testConfigMap, names.test)),
    }
  }

  private getDependencyNodes(
    nodeType: ConfigGraphNodeType, name: string, recursive: boolean, filterFn?: DependencyRelationFilterFn,
  ): ConfigGraphNode[] {
    const node = this.index[nodeKey(nodeType, name)]
    if (node) {
      if (recursive) {
        return node.recursiveDependencies(filterFn)
      } else {
        return filterFn ? node.dependencies.filter(filterFn) : node.dependencies
      }
    } else {
      return []
    }
  }

  private getDependantNodes(
    nodeType: ConfigGraphNodeType, name: string, recursive: boolean, filterFn?: DependencyRelationFilterFn,
  ): ConfigGraphNode[] {
    const node = this.index[nodeKey(nodeType, name)]
    if (node) {
      if (recursive) {
        return node.recursiveDependants(filterFn)
      } else {
        return filterFn ? node.dependants.filter(filterFn) : node.dependants
      }
    } else {
      return []
    }
  }

  private uniqueNames(nodes: ConfigGraphNode[], type: ConfigGraphNodeType) {
    return uniq(nodes.filter(n => n.type === type).map(n => n.name))
  }

  // Idempotent.
  private addRelation(
    dependant: ConfigGraphNode, dependencyType: ConfigGraphNodeType,
    dependencyName: string, dependencyModuleName: string,
  ) {
    const dependency = this.getNode(dependencyType, dependencyName, dependencyModuleName)
    dependant.addDependency(dependency)
    dependency.addDependant(dependant)
  }

  // Idempotent.
  private getNode(type: ConfigGraphNodeType, name: string, moduleName: string) {
    const key = nodeKey(type, name)
    const existingNode = this.index[key]
    if (existingNode) {
      return existingNode
    } else {
      const newNode = new ConfigGraphNode(type, name, moduleName)
      this.index[key] = newNode
      return newNode
    }
  }

  // For testing/debugging.
  renderGraph() {
    const nodes = Object.values(this.index)
    const edges: string[][] = []
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        edges.push([nodeKey(node.type, node.name), nodeKey(dep.type, dep.name)])
      }
    }
    return edges
  }

}

class ConfigGraphNode {
  type: ConfigGraphNodeType
  name: string // same as a corresponding task's name
  moduleName: string
  dependencies: ConfigGraphNode[]
  dependants: ConfigGraphNode[]

  constructor(type: ConfigGraphNodeType, name: string, moduleName: string) {
    this.type = type
    this.name = name
    this.moduleName = moduleName
    this.dependencies = []
    this.dependants = []
  }

  // Idempotent.
  addDependency(node: ConfigGraphNode) {
    const key = nodeKey(node.type, node.name)
    if (!this.dependencies.find(d => nodeKey(d.type, d.name) === key)) {
      this.dependencies.push(node)
    }
  }

  // Idempotent.
  addDependant(node: ConfigGraphNode) {
    const key = nodeKey(node.type, node.name)
    if (!this.dependants.find(d => nodeKey(d.type, d.name) === key)) {
      this.dependants.push(node)
    }
  }

  /**
   * If filterFn is provided, ignores matching nodes and their dependencies.
   * Note: May return duplicate entries (deduplicated in ConfigGraph#toRelations).
   */
  recursiveDependencies(filterFn?: DependencyRelationFilterFn) {
    const deps = filterFn ? this.dependencies.filter(filterFn) : this.dependencies
    return flatten(deps.concat(
      deps.map(d => d.recursiveDependencies(filterFn))))
  }

  /**
   * If filterFn is provided, ignores matching nodes and their dependants.
   * Note: May return duplicate entries (deduplicated in ConfigGraph#toRelations).
   */
  recursiveDependants(filterFn?: DependencyRelationFilterFn) {
    const dependants = filterFn ? this.dependants.filter(filterFn) : this.dependants
    return flatten(dependants.concat(
      dependants.map(d => d.recursiveDependants(filterFn))))
  }

}

/**
 * Note: If type === "build", name should be a prefix-qualified module name, as
 * returned by keyForModule or getModuleKey.
 */
function nodeKey(type: ConfigGraphNodeType, name: string) {
  return `${type}.${name}`
}

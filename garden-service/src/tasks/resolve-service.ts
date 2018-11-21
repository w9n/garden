/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { BaseTask, TaskParams } from "./base"
import { TaskResults } from "../task-graph"
import { Service } from "../types/service"
import { flatten } from "lodash"
import { ConfigurationError } from "../exceptions"
import { ResolveModuleTask } from "./resolve-module"
import * as Bluebird from "bluebird"

interface ServiceMap {
  [name: string]: Service
}

export class ResolveServicesTask extends BaseTask<TaskParams, ServiceMap> {
  type = "resolve-services"

  protected getName() {
    return "*"
  }

  getDescription() {
    return `resolving services`
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

    const services: ServiceMap = {}

    for (const service of flatten(modules.map(m => m.services))) {
      if (services[service.name]) {
        const moduleA = services[service.name].module.name
        const moduleB = service.module.name

        throw new ConfigurationError(
          `Service names must be unique - ${service.name} is declared multiple times ` +
          `(in '${moduleA}' and '${moduleB}')`,
          {
            serviceName: service.name,
            moduleA,
            moduleB,
          },
        )
      }

      services[service.name] = service
    }

    return services
  }
}

interface ResolveServiceParams extends TaskParams {
  serviceName: string
}

export class ResolveServiceTask extends BaseTask<TaskParams, Service> {
  type = "resolve-service"

  private serviceName: string

  constructor(params: ResolveServiceParams) {
    super(params)
    this.serviceName = params.serviceName
  }

  protected getName() {
    return this.serviceName
  }

  getDescription() {
    return `resolving service ${this.serviceName}`
  }

  async getDependencies() {
    return [new ResolveServicesTask({
      garden: this.garden,
      force: this.force,
      version: this.version,
    })]
  }

  async process(dependencyResults: TaskResults) {
    const services = this.getDependencyResult(dependencyResults, (await this.getDependencies())[0]).output!
    const service = services[this.serviceName]

    if (!service) {
      throw new ConfigurationError(`Could not find service "${this.serviceName}"`, {
        serviceName: this.serviceName,
        configuredServices: Object.keys(services),
      })
    }

    return service
  }
}

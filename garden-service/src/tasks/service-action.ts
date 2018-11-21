/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ServiceTaskParams, ServiceTask } from "./base"
import { TaskResults } from "../task-graph"
import { ServiceActions } from "../types/plugin/plugin"
import { ServiceActionOutputs } from "../types/plugin/outputs"
import { ServiceActionParams } from "../types/plugin/params"
import { Omit } from "../util/util"

interface Params<T extends keyof ServiceActions> extends ServiceTaskParams {
  action: T
  actionParams: Omit<
    ServiceActionParams[T],
    "ctx" | "service" | "module" | "runtimeContext"
  >
}

/**
 * Generic task to perform a specified service action on the specified service.
 */
export class ServiceActionTask<T extends keyof ServiceActions> extends ServiceTask<Params<T>, ServiceActionOutputs[T]> {
  type = ""   // specified in constructor

  private actionType: T
  private actionParams: Params<T>["actionParams"]

  constructor(params: Params<T>) {
    super(params)
    this.type = this.actionType = params.action
    this.actionParams = params.actionParams
  }

  getDescription() {
    return `${this.type}: ${this.serviceConfig.name}`
  }

  async process(dependencyResults: TaskResults) {
    const service = await this.getService(dependencyResults)

    const module = service.module

    const handler = await this.garden.getModuleActionHandler({
      moduleType: module.type,
      actionType: this.actionType,
      //defaultHandler,
    })

    // TODO: hmm, maybe we need a way to return tasks in process()?
    const deps = await this.garden.getServices(service.config.dependencies)
    const runtimeContext = this.actionParams.runtimeContext || await prepareRuntimeContext(this.garden, module, deps)

    const handlerParams: any = {
      ...this.commonParams(handler),
      ...<object>this.params,
      module,
      runtimeContext,
    }

    return (<Function>handler)(handlerParams)
  }
}

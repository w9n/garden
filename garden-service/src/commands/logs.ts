/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  Command,
  CommandResult,
  CommandParams,
  StringsParameter,
  IntegerParameter,
  BooleanParameter,
} from "./base"
import chalk from "chalk"
import { ServiceLogEntry } from "../types/plugin/outputs"
import Bluebird = require("bluebird")
import { Service, getServiceRuntimeContext } from "../types/service"
import Stream from "ts-stream"
import { LoggerType } from "../logger/logger"
import dedent = require("dedent")
import { LogLevel } from "../logger/log-node"

const logsArgs = {
  services: new StringsParameter({
    help: "The name(s) of the service(s) to log (skip to log all services). " +
      "Use comma as a separator to specify multiple services.",
  }),
}

const logsOpts = {
  follow: new BooleanParameter({
    help: "Continuously stream new logs from the service(s).",
    alias: "f",
    cliOnly: true,
  }),
  tail: new IntegerParameter({
    help: "Number of lines to show for each service. Defaults to -1, showing all log lines.",
    alias: "t",
    defaultValue: -1,
  }),
  // TODO
  // since: new MomentParameter({ help: "Retrieve logs from the specified point onwards" }),
}

type Args = typeof logsArgs
type Opts = typeof logsOpts

export class LogsCommand extends Command<Args, Opts> {
  name = "logs"
  help = "Retrieves the most recent logs for the specified service(s)."

  description = dedent`
    Outputs logs for all or specified services, and optionally waits for news logs to come in.

    Examples:

        garden logs               # prints latest logs from all services
        garden logs my-service    # prints latest logs for my-service
        garden logs -t            # keeps running and streams all incoming logs to the console
  `

  arguments = logsArgs
  options = logsOpts
  loggerType: LoggerType = "basic"

  async action({ garden, log, args, opts }: CommandParams<Args, Opts>): Promise<CommandResult<ServiceLogEntry[]>> {
    const { follow, tail } = opts
    const graph = await garden.getConfigGraph()
    const services = await graph.getServices(args.services)

    const result: ServiceLogEntry[] = []
    const stream = new Stream<ServiceLogEntry>()

    void stream.forEach((entry) => {
      // TODO: color each service differently for easier visual parsing
      let timestamp = "                        "

      // bad timestamp values can cause crash if not caught
      if (entry.timestamp) {
        try {
          timestamp = entry.timestamp.toISOString()
        } catch { }
      }

      log.info({
        section: entry.serviceName,
        msg: [timestamp, chalk.white(entry.msg)],
      })

      if (!follow) {
        result.push(entry)
      }
    })

    const actions = await garden.getActionHandler()

    await Bluebird.map(services, async (service: Service<any>) => {
      const voidLog = log.placeholder(LogLevel.silly, { childEntriesInheritLevel: true })
      const runtimeContext = await getServiceRuntimeContext(garden, graph, service)
      const status = await actions.getServiceStatus({ log: voidLog, service, hotReload: false, runtimeContext })

      if (status.state === "ready" || status.state === "outdated") {
        await actions.getServiceLogs({ log, service, stream, follow, tail, runtimeContext })
      } else {
        await stream.write({
          serviceName: service.name,
          timestamp: new Date(),
          msg: chalk.yellow(`<Service not running (state: ${status.state}). Please deploy the service and try again.>`),
        })
      }
    })

    return { result }
  }
}

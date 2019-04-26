/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import chalk from "chalk"
import { RunResult } from "../../types/plugin/outputs"
import {
  BooleanParameter,
  Command,
  CommandParams,
  StringParameter,
  CommandResult,
  StringsParameter,
} from "../base"
import { printRuntimeContext, runtimeContextForServiceDeps } from "./run"
import dedent = require("dedent")
import { logHeader } from "../../logger/util"
import { PushTask } from "../../tasks/push"

const runArgs = {
  module: new StringParameter({
    help: "The name of the module to run.",
    required: true,
  }),
  // TODO: make this a variadic arg
  command: new StringsParameter({
    help: "The command to run in the module.",
  }),
}

const runOpts = {
  // TODO: we could provide specific parameters like this by adding commands for specific modules, via plugins
  //entrypoint: new StringParameter({ help: "Override default entrypoint in module" }),
  "interactive": new BooleanParameter({
    help: "Set to false to skip interactive mode and just output the command result.",
    defaultValue: false,
    cliDefault: true,
    cliOnly: true,
  }),
  "force-build": new BooleanParameter({ help: "Force rebuild of module before running." }),
}

type Args = typeof runArgs
type Opts = typeof runOpts

export class RunModuleCommand extends Command<Args, Opts> {
  name = "module"
  help = "Run an ad-hoc instance of a module."

  description = dedent`
    This is useful for debugging or ad-hoc experimentation with modules.

    Examples:

        garden run module my-container                                   # run an ad-hoc instance of a my-container \
         container and attach to it
        garden run module my-container /bin/sh                           # run an interactive shell in a new \
         my-container container
        garden run module my-container --interactive=false /some/script  # execute a script in my-container and \
         return the output
  `

  arguments = runArgs
  options = runOpts

  async action({ garden, log, args, opts }: CommandParams<Args, Opts>): Promise<CommandResult<RunResult>> {
    const moduleName = args.module

    const graph = await garden.getConfigGraph()
    const module = await graph.getModule(moduleName)

    const msg = args.command
      ? `Running command ${chalk.white(args.command.join(" "))} in module ${chalk.white(moduleName)}`
      : `Running module ${chalk.white(moduleName)}`

    logHeader({
      log,
      emoji: "runner",
      command: msg,
    })

    const actions = await garden.getActionHandler()
    await actions.prepareEnvironment({ log })

    const pushTask = new PushTask({ garden, log, module, force: opts["force-build"] })
    await garden.processTasks([pushTask])

    const command = args.command || []

    const runtimeContext = await runtimeContextForServiceDeps(garden, graph, module)

    printRuntimeContext(log, runtimeContext)

    log.info("")

    const result = await actions.runModule({
      log,
      module,
      command,
      runtimeContext,
      interactive: opts.interactive,
    })

    return { result }
  }
}

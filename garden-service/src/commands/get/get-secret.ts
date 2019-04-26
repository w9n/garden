/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { NotFoundError } from "../../exceptions"
import {
  Command,
  CommandResult,
  CommandParams,
  StringParameter,
} from "../base"
import dedent = require("dedent")

const getSecretArgs = {
  provider: new StringParameter({
    help: "The name of the provider to read the secret from.",
    required: true,
  }),
  key: new StringParameter({
    help: "The key of the configuration variable.",
    required: true,
  }),
}

type GetArgs = typeof getSecretArgs

// TODO: allow omitting key to return all configs

export class GetSecretCommand extends Command<GetArgs> {
  name = "secret"
  help = "Get a secret from the environment."

  description = dedent`
    Returns with an error if the provided key could not be found.

    Examples:

        garden get secret kubernetes somekey
        garden get secret local-kubernetes some-other-key
  `

  arguments = getSecretArgs

  async action({ garden, log, args }: CommandParams<GetArgs>): Promise<CommandResult> {
    const key = args.key
    const actions = await garden.getActionHandler()
    const { value } = await actions.getSecret({
      pluginName: args.provider,
      key,
      log,
    })

    if (value === null || value === undefined) {
      throw new NotFoundError(`Could not find config key ${key}`, { key })
    }

    log.info(value)

    return { [key]: value }
  }
}

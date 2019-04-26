/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as yaml from "js-yaml"
import { highlightYaml, deepFilter } from "../../util/util"
import {
  Command,
  CommandResult,
  CommandParams,
} from "../base"
import { EnvironmentStatus } from "../../actions"

export class GetStatusCommand extends Command {
  name = "status"
  help = "Outputs the status of your environment."

  async action({ garden, log }: CommandParams): Promise<CommandResult<EnvironmentStatus>> {
    const actions = await garden.getActionHandler()
    const status = await actions.getStatus({ log })

    // TODO: we should change the status format because this will remove services called "detail"
    const withoutDetail = deepFilter(status, (_, key) => key !== "detail")

    const yamlStatus = yaml.safeDump(withoutDetail, { noRefs: true, skipInvalid: true })

    // TODO: do a nicer print of this by default and use --yaml/--json options for exporting
    log.info(highlightYaml(yamlStatus))

    return { result: status }
  }
}

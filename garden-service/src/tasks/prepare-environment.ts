/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { TaskParams, BaseTask } from "../tasks/base"
import { Provider } from "../config/project"
import { validate } from "../config/common"
import * as Bluebird from "bluebird"
import { ProviderConfigContext } from "../config/config-context"
import { resolveTemplateStrings } from "../template-string"
import { ConfigurationError } from "../exceptions"

interface Params extends TaskParams {
  provider: Provider
  allowUserInput: boolean
}

export class PrepareEnvironmentTask extends BaseTask<Params, Provider> {
  type = "prepare-environment"

  private provider: Provider
  private allowUserInput: boolean

  constructor(params: Params) {
    super(params)
    this.provider = params.provider
  }

  getDescription() {
    return `preparing environment for provider ${this.getName()}`
  }

  getName() {
    return this.provider.name
  }

  async computeDependencies() {
    return Bluebird.map(this.provider.dependencies, async (dependencyName) => {
      return new PrepareEnvironmentTask({
        garden: this.garden,
        force: this.force,
        version: this.version,
        provider: await this.garden.getProvider(dependencyName),
        allowUserInput: this.allowUserInput,
      })
    })
  }

  async process(dependencyResults: TaskResults) {
    // Get resolved providers from dependency results
    const providers = await this.getResolvedProviders(dependencyResults)

    const configContext = new ProviderConfigContext(
      this.garden,
      providers,
    )

    // Fully resolve the provider configuration.
    const pluginName = this.provider.name
    const plugin = await this.garden.getPlugin(pluginName)
    let config = await resolveTemplateStrings(this.provider.config, configContext)

    const configureOutput = await this.garden.actions.configureProvider({ pluginName, config })
    config = configureOutput.config

    if (plugin.configSchema) {
      config = validate(config, plugin.configSchema, { context: `${pluginName} provider configuration` })
    }

    const provider = { ...this.provider, config }

    // Make sure the environment is initialized
    const status = await this.garden.actions.getEnvironmentStatus({ pluginName })

    if (!this.allowUserInput && status.needUserInput) {
      throw new ConfigurationError(
        `Provider ${name} has been updated or has not yet been initialized, and requires user input. ` +
        `Please run \`garden init env\` and then re-run this command.`,
        { status },
      )
    }

    if (!status.ready) {
      const envLogEntry = this.garden.log.info({
        status: "active",
        section: name,
        msg: "Preparing environment...",
      })

      await this.garden.actions.prepareEnvironment({ pluginName, status, force: this.force, logEntry: envLogEntry })

      envLogEntry.setSuccess("Ready")
    }

    return provider
  }
}

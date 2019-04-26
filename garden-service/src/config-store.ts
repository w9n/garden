/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as Joi from "joi"
import * as yaml from "js-yaml"
import { resolve } from "path"
import { ensureFile, readFile } from "fs-extra"
import { get, isPlainObject, unset } from "lodash"

import { Primitive, validate, joiArray, joiUserIdentifier } from "./config/common"
import { LocalConfigError } from "./exceptions"
import { dumpYaml } from "./util/util"
import { GARDEN_DIR_NAME, LOCAL_CONFIG_FILENAME } from "./constants"

export type ConfigValue = Primitive | Primitive[] | Object[]

export type SetManyParam = { keyPath: Array<string>, value: ConfigValue }[]

export abstract class ConfigStore<T extends object = any> {
  private config: null | T
  protected configPath: string

  constructor(projectPath: string) {
    this.configPath = this.getConfigPath(projectPath)
    this.config = null
  }

  abstract getConfigPath(projectPath: string): string
  abstract validate(config): T

  /**
   * Would've been nice to allow something like: set(["path", "to", "valA", valA], ["path", "to", "valB", valB]...)
   * but Typescript support is missing at the moment
   */
  public async set(param: SetManyParam)
  public async set(keyPath: string[], value: ConfigValue)
  public async set(...args) {
    let config = await this.getConfig()
    let entries: SetManyParam

    if (args.length === 1) {
      entries = args[0]
    } else {
      entries = [{ keyPath: args[0], value: args[1] }]
    }

    for (const { keyPath, value } of entries) {
      config = this.updateConfig(config, keyPath, value)
    }

    await this.saveConfig(config)
  }

  public async get(): Promise<T>
  public async get(keyPath: string[]): Promise<Object | ConfigValue>
  public async get(keyPath?: string[]): Promise<Object | ConfigValue> {
    const config = await this.getConfig()

    if (keyPath) {
      const value = get(config, keyPath)

      if (value === undefined) {
        this.throwKeyNotFound(config, keyPath)
      }

      return value
    }

    return config
  }

  public async clear() {
    await this.saveConfig(<T>{})
  }

  public async delete(keyPath: string[]) {
    let config = await this.getConfig()
    if (get(config, keyPath) === undefined) {
      this.throwKeyNotFound(config, keyPath)
    }
    const success = unset(config, keyPath)
    if (!success) {
      throw new LocalConfigError(`Unable to delete key ${keyPath.join(".")} in user config`, {
        keyPath,
        config,
      })
    }
    await this.saveConfig(config)
  }

  private async getConfig(): Promise<T> {
    if (!this.config) {
      await this.loadConfig()
    }
    // Spreading does not work on generic types, see: https://github.com/Microsoft/TypeScript/issues/13557
    return Object.assign(this.config, {})

  }

  private updateConfig(config: T, keyPath: string[], value: ConfigValue): T {
    let currentValue = config

    for (let i = 0; i < keyPath.length; i++) {
      const k = keyPath[i]

      if (i === keyPath.length - 1) {
        currentValue[k] = value
      } else if (currentValue[k] === undefined) {
        currentValue[k] = {}
      } else if (!isPlainObject(currentValue[k])) {
        const path = keyPath.slice(i + 1).join(".")

        throw new LocalConfigError(
          `Attempting to assign a nested key on non-object (current value at ${path}: ${currentValue[k]})`,
          {
            currentValue: currentValue[k],
            path,
          },
        )
      }

      currentValue = currentValue[k]
    }
    return config
  }

  private async ensureConfigFile() {
    await ensureFile(this.configPath)
  }

  private async loadConfig() {
    await this.ensureConfigFile()
    const config = await yaml.safeLoad((await readFile(this.configPath)).toString()) || {}

    this.config = this.validate(config)
  }

  private async saveConfig(config: T) {
    this.config = null
    const validated = this.validate(config)
    await dumpYaml(this.configPath, validated)
    this.config = validated
  }

  private throwKeyNotFound(config: T, keyPath: string[]) {
    throw new LocalConfigError(`Could not find key ${keyPath.join(".")} in user config`, {
      keyPath,
      config,
    })
  }

}

// TODO: Camel case previous usernames
export interface KubernetesLocalConfig {
  username?: string
  "previous-usernames"?: Array<string>
}

export interface LinkedSource {
  name: string
  path: string
}

export interface LocalConfig {
  kubernetes?: KubernetesLocalConfig
  linkedModuleSources?: LinkedSource[] // TODO Use KeyedSet instead of array
  linkedProjectSources?: LinkedSource[]
}

const kubernetesLocalConfigSchema = Joi.object()
  .keys({
    "username": joiUserIdentifier().allow("").optional(),
    "previous-usernames": Joi.array().items(joiUserIdentifier()).optional(),
  })
  .meta({ internal: true })

const linkedSourceSchema = Joi.object()
  .keys({
    name: joiUserIdentifier(),
    path: Joi.string(),
  })
  .meta({ internal: true })

const localConfigSchemaKeys = {
  kubernetes: kubernetesLocalConfigSchema,
  linkedModuleSources: joiArray(linkedSourceSchema),
  linkedProjectSources: joiArray(linkedSourceSchema),
}

export const localConfigKeys = Object.keys(localConfigSchemaKeys).reduce((acc, key) => {
  acc[key] = key
  return acc
}, {}) as { [K in keyof typeof localConfigSchemaKeys]: K }

const localConfigSchema = Joi.object()
  .keys(localConfigSchemaKeys)
  .meta({ internal: true })

// TODO: we should not be passing this to provider actions
export const configStoreSchema = Joi.object()
  .description("Helper class for managing local configuration for plugins.")

export class LocalConfigStore extends ConfigStore<LocalConfig> {

  getConfigPath(projectPath): string {
    return resolve(projectPath, GARDEN_DIR_NAME, LOCAL_CONFIG_FILENAME)
  }

  validate(config): LocalConfig {
    return validate(
      config,
      localConfigSchema,
      { context: this.configPath, ErrorClass: LocalConfigError },
    )
  }

}

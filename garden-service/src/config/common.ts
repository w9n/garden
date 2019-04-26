/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { JoiObject } from "joi"
import * as Joi from "joi"
import * as uuid from "uuid"
import { ConfigurationError, LocalConfigError } from "../exceptions"
import chalk from "chalk"
import { relative } from "path"

export type Primitive = string | number | boolean

export interface PrimitiveMap { [key: string]: Primitive }
export interface DeepPrimitiveMap { [key: string]: Primitive | DeepPrimitiveMap | Primitive[] | DeepPrimitiveMap[] }

// export type ConfigWithSpec<S extends object> = <T extends S>{
//   spec: Omit<T, keyof S> & Partial<S>
// }

export const enumToArray = Enum => (
  Object.values(Enum).filter(k => typeof k === "string") as string[]
)

export const joiPrimitive = () => Joi.alternatives().try(Joi.number(), Joi.string(), Joi.boolean())
  .description("Number, string or boolean")

export const absolutePathRegex = /^\/.*/ // Note: Only checks for the leading slash
// from https://stackoverflow.com/a/12311250/3290965
export const identifierRegex = /^(?![0-9]+$)(?!.*-$)(?!-)[a-z0-9-]{1,63}$/
export const userIdentifierRegex = /^(?!garden)(?=.{1,63}$)[a-z][a-z0-9]*(-[a-z0-9]+)*$/
export const envVarRegex = /^(?!garden)[a-z_][a-z0-9_]*$/i

export const joiIdentifier = () => Joi.string()
  .regex(identifierRegex)
  .description(
    "Valid RFC1035/RFC1123 (DNS) label (may contain lowercase letters, numbers and dashes, must start with a letter, " +
    "and cannot end with a dash) and must not be longer than 63 characters.",
  )

export const joiProviderName = (name: string) => joiIdentifier().required()
  .description("The name of the provider plugin to use.")
  .default(name)
  .example(name)

export const joiStringMap = (valueSchema: JoiObject) => Joi
  .object().pattern(/.+/, valueSchema)

export const joiUserIdentifier = () => Joi.string()
  .regex(userIdentifierRegex)
  .description(
    "Valid RFC1035/RFC1123 (DNS) label (may contain lowercase letters, numbers and dashes, must start with a letter, " +
    "and cannot end with a dash), cannot contain consecutive dashes or start with `garden`, " +
    "or be longer than 63 characters.",
  )

export const joiIdentifierMap = (valueSchema: JoiObject) => Joi
  .object().pattern(identifierRegex, valueSchema)
  .default(() => ({}), "{}")
  .description("Key/value map. Keys must be valid identifiers.")

export const joiVariables = () => Joi
  .object().pattern(/[\w\d]+/i, joiPrimitive())
  .default(() => ({}), "{}")
  .unknown(false)
  .description("Key/value map. Keys may contain letters and numbers, and values must be primitives.")

export const joiEnvVars = () => Joi
  .object().pattern(envVarRegex, joiPrimitive())
  .default(() => ({}), "{}")
  .unknown(false)
  .description(
    "Key/value map of environment variables. Keys must be valid POSIX environment variable names " +
    "(must not start with `GARDEN`) and values must be primitives.",
  )

export const joiArray = (schema) => Joi
  .array().items(schema)
  .default(() => [], "[]")

export const joiRepositoryUrl = () => Joi
  .string()
  .uri({
    // TODO Support other protocols?
    scheme: [
      "git",
      /git\+https?/,
      "https",
      "file",
    ],
  })
  .description(
    "A remote repository URL. Currently only supports git servers. Must contain a hash suffix" +
    " pointing to a specific branch or tag, with the format: <git remote url>#<branch|tag>",
  )
  .example("git+https://github.com/org/repo.git#v2.0")

export function isPrimitive(value: any) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

const joiPathPlaceholder = uuid.v4()
const joiPathPlaceholderRegex = new RegExp(joiPathPlaceholder, "g")
const joiOptions = {
  abortEarly: false,
  language: {
    key: `key ${joiPathPlaceholder} `,
    object: {
      allowUnknown: `!!key "{{!child}}" is not allowed at path ${joiPathPlaceholder}`,
      child: "!!\"{{!child}}\": {{reason}}",
      xor: `!!object at ${joiPathPlaceholder} only allows one of {{peersWithLabels}}`,
    },
  },
}

export interface ValidateOptions {
  context?: string // Descriptive text to include in validation error messages, e.g. "module at some/local/path"
  ErrorClass?: typeof ConfigurationError | typeof LocalConfigError
}

export interface ValidateWithPathParams<T> {
  config: T,
  schema: Joi.Schema,
  path: string, // Absolute path to the config file, including filename
  projectRoot: string,
  name?: string, // Name of the top-level entity that the config belongs to, e.g. "some-module" or "some-project"
  configType?: string // The type of top-level entity that the config belongs to, e.g. "module" or "project"
  ErrorClass?: typeof ConfigurationError | typeof LocalConfigError
}

/**
 * Should be used whenever a path to the corresponding config file is available while validating config
 * files.
 *
 * This is to ensure consistent error messages that include the relative path to the failing file.
 */
export function validateWithPath<T>(
  { config, schema, path, projectRoot, name, configType = "module", ErrorClass }: ValidateWithPathParams<T>,
) {

  const validateOpts = {
    context: `${configType} ${name ? name + " " : ""}(${relative(projectRoot, path)}/garden.yml)`,
  }

  if (ErrorClass) {
    validateOpts["ErrorClass"] = ErrorClass
  }

  return <T>validate(config, schema, validateOpts)
}

export function validate<T>(
  value: T,
  schema: Joi.Schema,
  { context = "", ErrorClass = ConfigurationError }: ValidateOptions = {},
): T {
  const result = schema.validate(value, joiOptions)
  const error = result.error

  if (error) {
    const description = schema.describe()

    const errorDetails = error.details.map((e) => {
      // render the key path in a much nicer way
      let renderedPath = "."

      if (e.path.length) {
        renderedPath = ""
        let d = description

        for (const part of e.path) {
          if (d.children && d.children[part]) {
            renderedPath += "." + part
            d = d.children[part]
          } else if (d.patterns) {
            for (const p of d.patterns) {
              if (part.match(new RegExp(p.regex.slice(1, -1)))) {
                renderedPath += `[${part}]`
                d = p.rule
                break
              }
            }
          } else {
            renderedPath += `[${part}]`
          }
        }
      }

      // a little hack to always use full key paths instead of just the label
      e.message = e.message.replace(joiPathPlaceholderRegex, chalk.underline(renderedPath || "."))

      return e
    })

    const msgPrefix = context ? `Error validating ${context}` : "Validation error"
    const errorDescription = errorDetails.map(e => e.message).join(", ")

    throw new ErrorClass(`${msgPrefix}: ${errorDescription}`, {
      value,
      context,
      errorDescription,
      errorDetails,
    })
  }

  return result.value
}

/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { join, sep, resolve, relative } from "path"
import * as yaml from "js-yaml"
import { readFile } from "fs-extra"
import { omit, flatten, isPlainObject, find } from "lodash"
import { baseModuleSpecSchema, ModuleResource } from "./module"
import { ConfigurationError } from "../exceptions"
import { CONFIG_FILENAME } from "../constants"
import { ProjectResource } from "../config/project"

export interface GardenResource {
  apiVersion: string
  kind: string
  name: string
  path: string
}

const baseModuleSchemaKeys = Object.keys(baseModuleSpecSchema.describe().children).concat(["kind"])

export async function loadConfig(projectRoot: string, path: string): Promise<GardenResource[]> {
  // TODO: nicer error messages when load/validation fails
  const absPath = join(path, CONFIG_FILENAME)
  let fileData: Buffer
  let rawSpecs: any[]

  // loadConfig returns undefined if config file is not found in the given directory
  try {
    fileData = await readFile(absPath)
  } catch (err) {
    return []
  }

  try {
    rawSpecs = yaml.safeLoadAll(fileData.toString()) || []
  } catch (err) {
    throw new ConfigurationError(`Could not parse ${CONFIG_FILENAME} in directory ${path} as valid YAML`, err)
  }

  const resources: GardenResource[] = flatten(rawSpecs.map(s => prepareResources(s, path, projectRoot)))

  const projectSpecs = resources.filter(s => s.kind === "Project")

  if (projectSpecs.length > 1) {
    throw new ConfigurationError(`Multiple project declarations in ${path}`, { projectSpecs })
  }

  return resources
}

export type ConfigKind = "Module" | "Project"

/**
 * Each YAML document in a garden.yml file consists of a project definition and/or a module definition.
 *
 * A document can be structured according to either the (old) nested or the (new) flat style.
 *
 * In the nested style, the project/module's config is nested under the project/module key respectively.
 *
 * In the flat style, the project/module's config is at the top level, and the kind key is used to indicate
 * whether the entity being configured is a project or a module (similar to the YAML syntax for k8s object
 * definitions). The kind key is removed before validation, so that specs following both styles can be validated
 * with the same schema.
 */
function prepareResources(spec: any, path: string, projectRoot: string): GardenResource[] {
  if (!isPlainObject(spec)) {
    throw new ConfigurationError(`Invalid configuration found in ${path}`, { spec, path })
  }

  if (spec.kind) {
    return [prepareFlatConfigDoc(spec, path, projectRoot)]
  } else {
    return prepareScopedConfigDoc(spec, path)
  }
}

/**
 * The new / flat configuration style.
 *
 * The spec defines either a project or a module (determined by its "kind" field).
 */
function prepareFlatConfigDoc(spec: any, path: string, projectRoot: string): GardenResource {
  const kind = spec.kind

  if (kind === "Project") {
    return prepareProjectConfig(spec, path)
  } else if (kind === "Module") {
    return prepareModuleResource(spec, path)
  } else {
    const relPath = `${relative(projectRoot, path)}/garden.yml`
    throw new ConfigurationError(`Unknown config kind ${kind} in ${relPath}`, { kind, path: relPath })
  }
}

/**
 * The old / nested configuration style.
 *
 * The spec defines a project and/or a module, with the config for each nested under the "project" / "module" field,
 * respectively.
 */
function prepareScopedConfigDoc(spec: any, path: string): GardenResource[] {
  const resources: GardenResource[] = []

  if (spec.project) {
    resources.push(prepareProjectConfig(spec.project, path))
  }

  if (spec.module) {
    resources.push(prepareModuleResource(spec.module, path))
  }

  return resources
}

function prepareProjectConfig(projectSpec: any, path: string): ProjectResource {
  projectSpec.kind = "Project"
  projectSpec.path = path

  return projectSpec
}

function prepareModuleResource(moduleSpec: any, path: string): ModuleResource {
  /**
   * We allow specifying modules by name only as a shorthand:
   *   dependencies:
   *   - foo-module
   *   - name: foo-module // same as the above
   */
  const dependencies = moduleSpec.build && moduleSpec.build.dependencies
    ? moduleSpec.build.dependencies.map(dep => typeof dep === "string" ? { name: dep, copy: [] } : dep)
    : []

  // Built-in keys are validated here and the rest are put into the `spec` field
  return {
    apiVersion: moduleSpec.apiVersion,
    kind: "Module",
    allowPublish: moduleSpec.allowPublish,
    build: {
      dependencies,
    },
    description: moduleSpec.description,
    include: moduleSpec.include,
    name: moduleSpec.name,
    outputs: {},
    path,
    repositoryUrl: moduleSpec.repositoryUrl,
    serviceConfigs: [],
    spec: {
      ...omit(moduleSpec, baseModuleSchemaKeys),
      build: { ...moduleSpec.build, dependencies },
    },
    testConfigs: [],
    type: moduleSpec.type,
    taskConfigs: [],
  }
}

export async function findProjectConfig(path: string): Promise<ProjectResource | undefined> {
  let sepCount = path.split(sep).length - 1
  for (let i = 0; i < sepCount; i++) {
    const resources = await loadConfig(path, path)
    const projectResource = find(resources, r => r.kind === "Project")

    if (projectResource) {
      return <ProjectResource>projectResource
    } else {
      path = resolve(path, "..")
    }
  }

  return
}

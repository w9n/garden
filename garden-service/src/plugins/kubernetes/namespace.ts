/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { PluginContext } from "../../plugin-context"
import { KubeApi } from "./api"
import { KubernetesProvider } from "./kubernetes"
import { name as providerName } from "./kubernetes"
import { AuthenticationError } from "../../exceptions"
import { getPackageVersion } from "../../util/util"
import { LogEntry } from "../../logger/log-entry"
import { ConfigStore } from "../../config-store"

const GARDEN_VERSION = getPackageVersion()
type CreateNamespaceStatus = "pending" | "created"
const created: { [name: string]: CreateNamespaceStatus } = {}

export async function ensureNamespace(api: KubeApi, namespace: string) {
  if (!created[namespace]) {
    created[namespace] = "pending"
    const namespacesStatus = await api.core.listNamespace()

    for (const n of namespacesStatus.body.items) {
      if (n.status.phase === "Active") {
        created[n.metadata.name] = "created"
      }
    }

    if (created[namespace] !== "created") {
      // TODO: the types for all the create functions in the library are currently broken
      await createNamespace(api, namespace)
      created[namespace] = "created"
    }
  }
}

// Note: Does not check whether the namespace already exists.
export async function createNamespace(api: KubeApi, namespace: string) {
  // TODO: the types for all the create functions in the library are currently broken
  return api.core.createNamespace(<any>{
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: namespace,
      annotations: {
        "garden.io/generated": "true",
        "garden.io/version": GARDEN_VERSION,
      },
    },
  })
}

interface GetNamespaceParams {
  configStore: ConfigStore,
  log: LogEntry,
  projectName: string,
  provider: KubernetesProvider,
  suffix?: string,
  skipCreate?: boolean,
}

export async function getNamespace(
  { projectName, configStore: localConfigStore, log, provider, suffix, skipCreate }: GetNamespaceParams,
): Promise<string> {
  let namespace

  if (provider.config.namespace !== undefined) {
    namespace = provider.config.namespace
  } else {
    // Note: The local-kubernetes always defines a namespace name, so this logic only applies to the kubernetes provider
    // TODO: Move this logic out to the kubernetes plugin init/validation
    const localConfig = await localConfigStore.get()
    const k8sConfig = localConfig.kubernetes || {}
    let { username, ["previous-usernames"]: previousUsernames } = k8sConfig

    if (!username) {
      username = provider.config.defaultUsername
    }

    if (!username) {
      throw new AuthenticationError(
        `User not logged into provider ${providerName}. Please specify defaultUsername in provider ` +
        `config or run garden init.`,
        { previousUsernames, provider: providerName },
      )
    }

    namespace = `${username}--${projectName}`
  }

  if (suffix) {
    namespace = `${namespace}--${suffix}`
  }

  if (!skipCreate) {
    const api = await KubeApi.factory(log, provider.config.context)
    await ensureNamespace(api, namespace)
  }

  return namespace
}

export async function getAppNamespace(ctx: PluginContext, log: LogEntry, provider: KubernetesProvider) {
  return getNamespace({
    configStore: ctx.configStore,
    log,
    projectName: ctx.projectName,
    provider,
  })
}

export function getMetadataNamespace(ctx: PluginContext, log: LogEntry, provider: KubernetesProvider) {
  return getNamespace({
    configStore: ctx.configStore,
    log,
    projectName: ctx.projectName,
    provider,
    suffix: "metadata",
  })
}

export async function getAllNamespaces(api: KubeApi): Promise<string[]> {
  const allNamespaces = await api.core.listNamespace()
  return allNamespaces.body.items
    .map(n => n.metadata.name)
}

/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import * as Bluebird from "bluebird"
import * as inquirer from "inquirer"
import * as Joi from "joi"
import * as semver from "semver"
import { every, find, intersection, pick, uniq, values } from "lodash"

import { DeploymentError, TimeoutError, PluginError } from "../../exceptions"
import {
  PrepareEnvironmentParams,
  CleanupEnvironmentParams,
  GetEnvironmentStatusParams,
  PluginActionParamsBase,
} from "../../types/plugin/params"
import { deline } from "../../util/string"
import { sleep, getPackageVersion } from "../../util/util"
import { joiUserIdentifier } from "../../config/common"
import { KubeApi } from "./api"
import {
  getAppNamespace,
  getMetadataNamespace,
  getAllNamespaces,
  createNamespace,
} from "./namespace"
import { KUBECTL_DEFAULT_TIMEOUT, kubectl } from "./kubectl"
import { name as providerName, KubernetesProvider, KubernetesPluginContext } from "./kubernetes"
import { isSystemGarden, getSystemGarden, systemNamespace, systemMetadataNamespace } from "./system"
import { PluginContext } from "../../plugin-context"
import { LogEntry } from "../../logger/log-entry"
import { DashboardPage } from "../../config/dashboard"
import { checkTillerStatus, installTiller } from "./helm/tiller"

const MAX_STORED_USERNAMES = 5
const GARDEN_VERSION = getPackageVersion()
const SYSTEM_NAMESPACE_MIN_VERSION = "0.9.0"

/**
 * Used by both the remote and local plugin
 */
async function prepareNamespaces({ ctx, log }: GetEnvironmentStatusParams) {
  const k8sCtx = <KubernetesPluginContext>ctx
  const kubeContext = k8sCtx.provider.config.context

  try {
    // TODO: use API instead of kubectl (I just couldn't find which API call to make)
    await kubectl.exec({ log, context: kubeContext, args: ["version"] })
  } catch (err) {
    throw new DeploymentError(
      `Unable to connect to Kubernetes cluster. ` +
      `Please make sure it is running, reachable and that you have the right context configured.`,
      {
        kubeContext,
        ...err,
      },
    )
  }

  await Bluebird.all([
    getMetadataNamespace(k8sCtx, log, k8sCtx.provider),
    getAppNamespace(k8sCtx, log, k8sCtx.provider),
  ])
}

export async function getRemoteEnvironmentStatus({ ctx, log }: GetEnvironmentStatusParams) {
  const provider = <KubernetesProvider>ctx.provider
  const loggedIn = await getLoginStatus({ ctx, log })

  if (!loggedIn && !provider.config.namespace) {
    return {
      ready: false,
      needUserInput: true,
    }
  }

  await prepareNamespaces({ ctx, log })

  const ready = (await checkTillerStatus(ctx, provider, log)) === "ready"

  // Note: We don't need the system namespaces for remote k8s for now

  // const api = await KubeApi.factory(log, k8sCtx.provider.config.context)
  // const contextForLog = `Checking environment status for plugin "kubernetes"`
  // const sysNamespaceUpToDate = await systemNamespaceUpToDate(api, log, contextForLog)
  // if (!sysNamespaceUpToDate) {
  //   ready = false
  // }

  return {
    ready,
    needUserInput: false,
    detail: {},
  }
}

export async function getLocalEnvironmentStatus({ ctx, log }: GetEnvironmentStatusParams) {
  let ready = true
  let needUserInput = false
  let sysNamespaceUpToDate = true
  const dashboardPages: DashboardPage[] = []

  await prepareNamespaces({ ctx, log })

  const k8sCtx = <KubernetesPluginContext>ctx
  const provider = k8sCtx.provider

  if (!isSystemGarden(provider)) {
    // Check if system services are deployed
    const sysGarden = await getSystemGarden(<KubernetesProvider>ctx.provider)
    const sysCtx = <KubernetesPluginContext>await sysGarden.getPluginContext(ctx.provider.name)
    const actions = await sysGarden.getActionHandler()
    const sysStatus = await actions.getStatus({ log })

    const serviceStatuses = pick(sysStatus.services, getSystemServices(provider))

    const api = await KubeApi.factory(log, provider.config.context)

    const servicesReady = every(values(serviceStatuses).map(s => s.state === "ready"))
    const contextForLog = `Checking environment status for plugin "local-kubernetes"`
    sysNamespaceUpToDate = await systemNamespaceUpToDate(api, log, contextForLog)
    const systemReady = sysStatus.providers[provider.config.name].ready
      && servicesReady
      && sysNamespaceUpToDate

    if (!systemReady) {
      ready = false
    }

    // Check Tiller status
    if (await checkTillerStatus(k8sCtx, provider, log) !== "ready") {
      ready = false
    }

    if (await checkTillerStatus(sysCtx, sysCtx.provider, log) !== "ready") {
      ready = false
    }

    // Add the Kubernetes dashboard to the Garden dashboard
    const namespace = await getAppNamespace(k8sCtx, log, provider)
    const defaultHostname = provider.config.defaultHostname

    const dashboardStatus = sysStatus.services["kubernetes-dashboard"]
    const dashboardServiceResource = find(
      (dashboardStatus.detail || {}).remoteObjects || [],
      o => o.kind === "Service",
    )

    if (!!dashboardServiceResource) {
      const dashboardPort = dashboardServiceResource.spec.ports[0].nodePort

      if (!!dashboardPort) {
        dashboardPages.push({
          title: "Kubernetes",
          description: "The standard Kubernetes dashboard for this project",
          url: `http://${defaultHostname}:${dashboardPort}/#!/workload?namespace=${namespace}`,
          newWindow: true,
        })
      }
    }
  }

  return {
    ready,
    needUserInput,
    dashboardPages,
    detail: { needForce: !sysNamespaceUpToDate },
  }
}

export async function prepareRemoteEnvironment({ ctx, log }: PrepareEnvironmentParams) {
  const provider = <KubernetesProvider>ctx.provider
  const loggedIn = await getLoginStatus({ ctx, log })

  if (!loggedIn && !provider.config.namespace) {
    await login({ ctx, log })
  }

  // Note: We don't need the system namespaces for remote k8s for now

  // const api = await KubeApi.factory(log, provider.config.context)
  // const contextForLog = `Preparing environment for plugin "kubernetes"`
  // if (!await systemNamespaceUpToDate(api, log, contextForLog)) {
  //   await recreateSystemNamespaces(api, log)
  // }

  await installTiller(ctx, provider, log)

  return {}
}

export async function prepareLocalEnvironment({ ctx, log }: PrepareEnvironmentParams) {
  // make sure system services are deployed
  const k8sCtx = <KubernetesPluginContext>ctx
  if (!isSystemGarden(k8sCtx.provider)) {
    const api = await KubeApi.factory(log, k8sCtx.provider.config.context)
    const contextForLog = `Preparing environment for plugin "local-kubernetes"`
    const outdated = !(await systemNamespaceUpToDate(api, log, contextForLog))
    if (outdated) {
      await recreateSystemNamespaces(api, log)
    }
    await configureSystemServices({ ctx: k8sCtx, log, force: true })
    await installTiller(k8sCtx, k8sCtx.provider, log)
  }

  return {}
}

/**
 * Returns true if the garden-system namespace exists and has the version
 */
export async function systemNamespaceUpToDate(api: KubeApi, log: LogEntry, contextForLog: string): Promise<boolean> {
  let systemNamespaceRes
  try {
    systemNamespaceRes = await api.core.readNamespace(systemNamespace)
  } catch (err) {
    if (err.code === 404) {
      return false
    } else {
      throw err
    }
  }

  const versionInCluster = systemNamespaceRes.body.metadata.annotations["garden.io/version"]

  const upToDate = !!versionInCluster && semver.gte(semver.coerce(versionInCluster)!, SYSTEM_NAMESPACE_MIN_VERSION)

  log.debug(deline`
    ${contextForLog}: current version ${GARDEN_VERSION}, version in cluster: ${versionInCluster},
    oldest permitted version: ${SYSTEM_NAMESPACE_MIN_VERSION}, up to date: ${upToDate}
  `)

  return upToDate
}

/**
 * Returns true if the garden-system namespace was outdated.
 */
export async function recreateSystemNamespaces(api: KubeApi, log: LogEntry) {
  const entry = log.debug({
    section: "cleanup",
    msg: "Deleting outdated system namespaces...",
    status: "active",
  })
  await deleteNamespaces([systemNamespace, systemMetadataNamespace], api, log)
  entry.setState({ msg: "Creating system namespaces..." })
  await createNamespace(api, systemNamespace)
  await createNamespace(api, systemMetadataNamespace)
  entry.setState({ msg: "System namespaces up to date" })
  entry.setSuccess()
}

export async function cleanupEnvironment({ ctx, log }: CleanupEnvironmentParams) {
  const k8sCtx = <KubernetesPluginContext>ctx
  const api = await KubeApi.factory(log, k8sCtx.provider.config.context)
  const namespace = await getAppNamespace(k8sCtx, log, k8sCtx.provider)
  const entry = log.info({
    section: "kubernetes",
    msg: `Deleting namespace ${namespace} (this may take a while)`,
    status: "active",
  })

  await deleteNamespaces([namespace], api, entry)
  await logout({ ctx: k8sCtx, log })

  return {}
}

export async function deleteNamespaces(namespaces: string[], api: KubeApi, log?: LogEntry) {
  for (const ns of namespaces) {
    try {
      // Note: Need to call the delete method with an empty object
      // TODO: any cast is required until https://github.com/kubernetes-client/javascript/issues/52 is fixed
      await api.core.deleteNamespace(ns, <any>{})
    } catch (err) {
      // Ignore not found errors.
      if (err.code !== 404) {
        throw err
      }
    }
  }

  // Wait until namespaces have been deleted
  const startTime = new Date().getTime()
  while (true) {
    await sleep(2000)

    const nsNames = await getAllNamespaces(api)
    if (intersection(nsNames, namespaces).length === 0) {
      if (log) {
        log.setSuccess()
      }
      break
    }

    const now = new Date().getTime()
    if (now - startTime > KUBECTL_DEFAULT_TIMEOUT * 1000) {
      throw new TimeoutError(
        `Timed out waiting for namespace ${namespaces.join(", ")} delete to complete`,
        { namespaces },
      )
    }
  }
}

async function getLoginStatus({ ctx }: PluginActionParamsBase) {
  const localConfig = await ctx.configStore.get()
  let currentUsername
  if (localConfig.kubernetes) {
    currentUsername = localConfig.kubernetes.username
  }
  return !!currentUsername
}

async function login({ ctx, log }: PluginActionParamsBase) {
  const entry = log.info({ section: "kubernetes", msg: "Logging in..." })
  const localConfig = await ctx.configStore.get()

  let currentUsername
  let prevUsernames: Array<string> = []

  if (localConfig.kubernetes) {
    currentUsername = localConfig.kubernetes.username
    prevUsernames = localConfig.kubernetes["previous-usernames"] || []
  }

  if (currentUsername) {
    entry && entry.setDone({
      symbol: "info",
      msg: `Already logged in as user ${currentUsername}`,
    })

    return { loggedIn: true }
  }

  const promptName = "username"
  const newUserOption = "Add new user"
  type Ans = { [promptName]: string }
  let ans: Ans

  const inputPrompt = async () => {
    return inquirer.prompt({
      name: promptName,
      message: "Enter username",
      validate: input => {
        try {
          Joi.attempt(input.trim(), joiUserIdentifier())
        } catch (err) {
          return `Invalid username, please try again\nError: ${err.message}`
        }
        return true
      },
    })
  }
  const choicesPrompt = async () => {
    return inquirer.prompt({
      name: promptName,
      type: "list",
      message: "Log in as...",
      choices: [...prevUsernames, new inquirer.Separator(), newUserOption],
    })
  }
  if (prevUsernames.length > 0) {
    ans = await choicesPrompt() as Ans
    if (ans.username === newUserOption) {
      ans = await inputPrompt() as Ans
    }
  } else {
    ans = await inputPrompt() as Ans
  }

  const username = ans.username.trim()
  const newPrevUsernames = uniq([...prevUsernames, username].slice(-MAX_STORED_USERNAMES))

  await ctx.configStore.set([
    { keyPath: [providerName, "username"], value: username },
    { keyPath: [providerName, "previous-usernames"], value: newPrevUsernames },
  ])

  return { loggedIn: true }
}

async function logout({ ctx, log }: PluginActionParamsBase) {
  const entry = log.info({ section: "kubernetes", msg: "Logging out..." })
  const localConfig = await ctx.configStore.get()
  const k8sConfig = localConfig.kubernetes || {}

  if (k8sConfig.username) {
    await ctx.configStore.delete([providerName, "username"])
    entry && entry.setSuccess("Logged out")
  } else {
    entry && entry.setSuccess("Already logged out")
  }
}

async function configureSystemServices(
  { ctx, force, log }:
    { ctx: PluginContext, force: boolean, log: LogEntry },
) {
  const k8sCtx = <KubernetesPluginContext>ctx
  const provider = k8sCtx.provider
  const sysGarden = await getSystemGarden(provider)
  const sysCtx = <KubernetesPluginContext>await sysGarden.getPluginContext(provider.name)

  await installTiller(sysCtx, sysCtx.provider, log)

  // only deploy services if configured to do so (e.g. minikube bundles some required services as addons)
  const systemServices = getSystemServices(k8sCtx.provider)

  if (systemServices.length > 0) {
    const actions = await sysGarden.getActionHandler()
    const results = await actions.deployServices({
      log,
      serviceNames: systemServices,
      force,
    })

    const failed = values(results.taskResults).filter(r => !!r.error).length

    if (failed) {
      throw new PluginError(`local-kubernetes: ${failed} errors occurred when configuring environment`, {
        results,
      })
    }
  }
}

function getSystemServices(provider: KubernetesProvider) {
  const names = ["kubernetes-dashboard"]

  if (provider.config.setupIngressController === "nginx") {
    names.push("ingress-controller", "default-backend")
  }

  return names
}

/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { ConfigureModuleParams, ConfigureProviderParams } from "../../types/plugin/params"
import { join } from "path"
import {
  GcfModule,
  configureGcfModule,
} from "../google/google-cloud-functions"
import {
  GardenPlugin,
} from "../../types/plugin/plugin"
import { STATIC_DIR, DEFAULT_API_VERSION } from "../../constants"
import { ServiceConfig } from "../../config/service"
import { ContainerModuleConfig } from "../container/config"
import {
  ContainerServiceSpec,
  ServicePortProtocol,
} from "../container/config"

const pluginName = "local-google-cloud-functions"
const emulatorModuleName = "local-gcf-container"
const baseContainerName = `${pluginName}--${emulatorModuleName}`
const emulatorBaseModulePath = join(STATIC_DIR, emulatorModuleName)
const emulatorPort = 8010

export const gardenPlugin = (): GardenPlugin => ({
  actions: {
    async configureProvider({ config }: ConfigureProviderParams) {
      const emulatorConfig: ContainerModuleConfig = {
        allowPublish: false,
        apiVersion: DEFAULT_API_VERSION,
        build: {
          dependencies: [],
        },
        description: "Base container for running Google Cloud Functions emulator",
        name: "local-gcf-container",
        path: emulatorBaseModulePath,
        outputs: {},
        serviceConfigs: [],
        spec: {
          build: {
            dependencies: [],
          },
          buildArgs: {},
          services: [],
          tasks: [],
          tests: [],
        },
        taskConfigs: [],
        testConfigs: [],
        type: "container",
      }

      return {
        config,
        moduleConfigs: [emulatorConfig],
      }
    },
  },

  moduleActions: {
    "google-cloud-function": {
      async configure(params: ConfigureModuleParams<GcfModule>) {
        const parsed = await configureGcfModule(params)

        // convert the module and services to containers to run locally
        const serviceConfigs: ServiceConfig<ContainerServiceSpec>[] = parsed.serviceConfigs.map((s) => {
          const functionEntrypoint = s.spec.entrypoint || s.name

          const spec = {
            name: s.name,
            dependencies: s.dependencies,
            outputs: {
              ingress: `http://${s.name}:${emulatorPort}/local/local/${functionEntrypoint}`,
            },
            annotations: {},
            args: ["/app/start.sh", functionEntrypoint],
            daemon: false,
            ingresses: [{
              name: "default",
              annotations: {},
              hostname: s.spec.hostname,
              port: "http",
              path: "/",
            }],
            env: {},
            healthCheck: { tcpPort: "http" },
            ports: [
              {
                name: "http",
                protocol: <ServicePortProtocol>"TCP",
                containerPort: emulatorPort,
                servicePort: emulatorPort,
              },
            ],
            volumes: [],
          }

          return {
            name: spec.name,
            dependencies: spec.dependencies,
            outputs: spec.outputs,
            spec,
          }
        })

        return {
          apiVersion: DEFAULT_API_VERSION,
          allowPublish: true,
          build: {
            command: [],
            dependencies: parsed.build.dependencies.concat([{
              name: emulatorModuleName,
              plugin: pluginName,
              copy: [{
                source: "child/Dockerfile",
                target: "Dockerfile",
              }],
            }]),
          },
          name: parsed.name,
          outputs: {},
          path: parsed.path,
          type: "container",

          spec: {
            buildArgs: {
              baseImageName: `${baseContainerName}:\${modules.${baseContainerName}.version}`,
            },
            image: `${parsed.name}:\${modules.${parsed.name}.version}`,
            services: serviceConfigs.map(s => <ContainerServiceSpec>s.spec),
            tests: [],
          },

          serviceConfigs,
          taskConfigs: [],
          testConfigs: parsed.testConfigs,
        }
      },
    },
  },
})

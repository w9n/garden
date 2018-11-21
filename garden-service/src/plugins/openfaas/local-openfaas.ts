import { gardenPlugin as openFaasPlugin } from "./openfaas"

// all this currently does is set the dependency to local-kubernetes instead of kubernetes
export const gardenPlugin = () => {
  return { ...openFaasPlugin, dependencies: ["local-kubernetes"] }
}

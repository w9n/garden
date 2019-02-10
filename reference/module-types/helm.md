# Helm

Below is the schema reference for the `helm` module type. For an introduction to configuring Garden modules, please look at our [Configuration guide](../../using-garden/configuration-files.md).

The reference is divided into two sections. The [first section](helm.md#configuration-keys) lists and describes the available schema keys. The [second section](helm.md#complete-yaml-schema) contains the complete YAML schema.

## Configuration keys

### `module`

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.base`

[module](helm.md#module) &gt; base

The name of another `helm` module to use as a base for this one. Use this to re-use a Helm chart across multiple services. For example, you might have an organization-wide base chart for certain types of services. If set, this module will by default inherit the following properties from the base module: `serviceResource`, `values` Each of those can be overridden in this module. They will be merged with a JSON Merge Patch \(RFC 7396\).

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
module:
  ...
  base: "my-base-chart"
```

### `module.chart`

[module](helm.md#module) &gt; chart

A valid Helm chart name or URI \(same as you'd input to `helm install`\). Required if the module doesn't contain the Helm chart itself.

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
module:
  ...
  chart: "stable/nginx-ingress"
```

### `module.chartPath`

[module](helm.md#module) &gt; chartPath

The path, relative to the module path, to the chart sources \(i.e. where the Chart.yaml file is, if any\). Not used when `base` is specified.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.dependencies[]`

[module](helm.md#module) &gt; dependencies

List of names of services that should be deployed before this chart.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.releaseName`

[module](helm.md#module) &gt; releaseName

Optionally override the release name used when installing \(defaults to the module name\).

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.repo`

[module](helm.md#module) &gt; repo

The repository URL to fetch the chart from.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.serviceResource`

[module](helm.md#module) &gt; serviceResource

The Deployment, DaemonSet or StatefulSet that Garden should regard as the _Garden service_ in this module \(not to be confused with Kubernetes Service resources\). Because a Helm chart can contain any number of Kubernetes resources, this needs to be specified for certain Garden features and commands to work, such as hot-reloading. We currently map a Helm chart to a single Garden service, because all the resources in a Helm chart are deployed at once.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.serviceResource.kind`

[module](helm.md#module) &gt; [serviceResource](helm.md#module.serviceresource) &gt; kind

The type of Kubernetes resource to sync files to.

| Type | Required | Allowed Values |
| :--- | :--- | :--- |
| `string` | Yes | "Deployment", "DaemonSet", "StatefulSet" |

### `module.serviceResource.name`

[module](helm.md#module) &gt; [serviceResource](helm.md#module.serviceresource) &gt; name

The name of the resource to sync to. If the chart contains a single resource of the specified Kind, this can be omitted. This can include a Helm template string, e.g. ''. This allows you to easily match the dynamic names given by Helm. In most cases you should copy this directly from the template in question in order to match it. Note that you may need to add single quotes around the string for the YAML to be parsed correctly.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.serviceResource.containerName`

[module](helm.md#module) &gt; [serviceResource](helm.md#module.serviceresource) &gt; containerName

The name of a container in the target. Specify this if the target contains more than one container and the main container is not the first container in the spec.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.serviceResource.containerModule`

[module](helm.md#module) &gt; [serviceResource](helm.md#module.serviceresource) &gt; containerModule

The Garden module that contains the sources for the container. This needs to be specified under `serviceResource` in order to enable hot-reloading for the chart, but is not necessary for tasks and tests. Must be a `container` module, and for hot-reloading to work you must specify the `hotReload` field on the container module. Note: If you specify a module here, you don't need to specify it additionally under `build.dependencies`

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
module:
  ...
  serviceResource:
    ...
    containerModule: "my-container-module"
```

### `module.serviceResource.hotReloadArgs[]`

[module](helm.md#module) &gt; [serviceResource](helm.md#module.serviceresource) &gt; hotReloadArgs

If specified, overrides the arguments for the main container when running in hot-reload mode.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

Example:

```yaml
module:
  ...
  serviceResource:
    ...
    hotReloadArgs:
      - nodemon
      - my-server.js
```

### `module.skipDeploy`

[module](helm.md#module) &gt; skipDeploy

Set this to true if the chart should only be built, but not deployed as a service. Use this, for example, if the chart should only be used as a base for other modules.

| Type | Required |
| :--- | :--- |
| `boolean` | No |

### `module.tasks[]`

[module](helm.md#module) &gt; tasks

The task definitions for this module.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.tasks[].name`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; name

The name of the test.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.tasks[].dependencies[]`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; dependencies

The names of any services that must be running, and the names of any tasks that must be executed, before the test is run.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tasks[].timeout`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; timeout

Maximum duration \(in seconds\) of the test run.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.tasks[].resource`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; resource

The Deployment, DaemonSet or StatefulSet that Garden should use to execute this task. If not specified, the `serviceResource` configured on the module will be used. If neither is specified, an error will be thrown.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.tasks[].resource.kind`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; [resource](helm.md#module.tasks[].resource) &gt; kind

The type of Kubernetes resource to sync files to.

| Type | Required | Allowed Values |
| :--- | :--- | :--- |
| `string` | Yes | "Deployment", "DaemonSet", "StatefulSet" |

### `module.tasks[].resource.name`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; [resource](helm.md#module.tasks[].resource) &gt; name

The name of the resource to sync to. If the chart contains a single resource of the specified Kind, this can be omitted. This can include a Helm template string, e.g. ''. This allows you to easily match the dynamic names given by Helm. In most cases you should copy this directly from the template in question in order to match it. Note that you may need to add single quotes around the string for the YAML to be parsed correctly.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.tasks[].resource.containerName`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; [resource](helm.md#module.tasks[].resource) &gt; containerName

The name of a container in the target. Specify this if the target contains more than one container and the main container is not the first container in the spec.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.tasks[].resource.containerModule`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; [resource](helm.md#module.tasks[].resource) &gt; containerModule

The Garden module that contains the sources for the container. This needs to be specified under `serviceResource` in order to enable hot-reloading for the chart, but is not necessary for tasks and tests. Must be a `container` module, and for hot-reloading to work you must specify the `hotReload` field on the container module. Note: If you specify a module here, you don't need to specify it additionally under `build.dependencies`

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
module:
  ...
  tasks:
    - resource:
        ...
        containerModule: "my-container-module"
```

### `module.tasks[].resource.hotReloadArgs[]`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; [resource](helm.md#module.tasks[].resource) &gt; hotReloadArgs

If specified, overrides the arguments for the main container when running in hot-reload mode.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

Example:

```yaml
module:
  ...
  tasks:
    - resource:
        ...
        hotReloadArgs:
          - nodemon
          - my-server.js
```

### `module.tasks[].args[]`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; args

The arguments to pass to the pod used for execution.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tasks[].env`

[module](helm.md#module) &gt; [tasks](helm.md#module.tasks[]) &gt; env

Key/value map of environment variables. Keys must be valid POSIX environment variable names \(must not start with `GARDEN`\) and values must be primitives.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.tests[]`

[module](helm.md#module) &gt; tests

The test suite definitions for this module.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.tests[].name`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; name

The name of the test.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.tests[].dependencies[]`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; dependencies

The names of any services that must be running, and the names of any tasks that must be executed, before the test is run.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tests[].timeout`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; timeout

Maximum duration \(in seconds\) of the test run.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.tests[].resource`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; resource

The Deployment, DaemonSet or StatefulSet that Garden should use to execute this test suite. If not specified, the `serviceResource` configured on the module will be used. If neither is specified, an error will be thrown.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.tests[].resource.kind`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; [resource](helm.md#module.tests[].resource) &gt; kind

The type of Kubernetes resource to sync files to.

| Type | Required | Allowed Values |
| :--- | :--- | :--- |
| `string` | Yes | "Deployment", "DaemonSet", "StatefulSet" |

### `module.tests[].resource.name`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; [resource](helm.md#module.tests[].resource) &gt; name

The name of the resource to sync to. If the chart contains a single resource of the specified Kind, this can be omitted. This can include a Helm template string, e.g. ''. This allows you to easily match the dynamic names given by Helm. In most cases you should copy this directly from the template in question in order to match it. Note that you may need to add single quotes around the string for the YAML to be parsed correctly.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.tests[].resource.containerName`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; [resource](helm.md#module.tests[].resource) &gt; containerName

The name of a container in the target. Specify this if the target contains more than one container and the main container is not the first container in the spec.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.tests[].resource.containerModule`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; [resource](helm.md#module.tests[].resource) &gt; containerModule

The Garden module that contains the sources for the container. This needs to be specified under `serviceResource` in order to enable hot-reloading for the chart, but is not necessary for tasks and tests. Must be a `container` module, and for hot-reloading to work you must specify the `hotReload` field on the container module. Note: If you specify a module here, you don't need to specify it additionally under `build.dependencies`

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
module:
  ...
  tests:
    - resource:
        ...
        containerModule: "my-container-module"
```

### `module.tests[].resource.hotReloadArgs[]`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; [resource](helm.md#module.tests[].resource) &gt; hotReloadArgs

If specified, overrides the arguments for the main container when running in hot-reload mode.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

Example:

```yaml
module:
  ...
  tests:
    - resource:
        ...
        hotReloadArgs:
          - nodemon
          - my-server.js
```

### `module.tests[].args[]`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; args

The arguments to pass to the pod used for testing.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tests[].env`

[module](helm.md#module) &gt; [tests](helm.md#module.tests[]) &gt; env

Key/value map of environment variables. Keys must be valid POSIX environment variable names \(must not start with `GARDEN`\) and values must be primitives.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.version`

[module](helm.md#module) &gt; version

The chart version to deploy.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.values`

[module](helm.md#module) &gt; values

Map of values to pass to Helm when rendering the templates. May include arrays and nested objects.

| Type | Required |
| :--- | :--- |
| `object` | No |

## Complete YAML schema

```yaml
module:
  base:
  chart:
  chartPath: .
  dependencies: []
  releaseName:
  repo:
  serviceResource:
    kind: Deployment
    name:
    containerName:
    containerModule:
    hotReloadArgs:
  skipDeploy: false
  tasks:
    - name:
      dependencies: []
      timeout: null
      resource:
        kind: Deployment
        name:
        containerName:
        containerModule:
        hotReloadArgs:
      args:
      env: {}
  tests:
    - name:
      dependencies: []
      timeout: null
      resource:
        kind: Deployment
        name:
        containerName:
        containerModule:
        hotReloadArgs:
      args:
      env: {}
  version:
  values: {}
```


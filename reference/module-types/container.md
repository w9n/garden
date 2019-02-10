# Container

Below is the schema reference for the `container` module type. For an introduction to configuring Garden modules, please look at our [Configuration guide](../../using-garden/configuration-files.md).

The reference is divided into two sections. The [first section](container.md#configuration-keys) lists and describes the available schema keys. The [second section](container.md#complete-yaml-schema) contains the complete YAML schema.

## Configuration keys

### `module`

Configuration for a container module.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.buildArgs`

[module](container.md#module) &gt; buildArgs

Specify build arguments to use when building the container image.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.image`

[module](container.md#module) &gt; image

Specify the image name for the container. Should be a valid Docker image identifier. If specified and the module does not contain a Dockerfile, this image will be used to deploy services for this module. If specified and the module does contain a Dockerfile, this identifier is used when pushing the built image.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.hotReload`

[module](container.md#module) &gt; hotReload

Specifies which files or directories to sync to which paths inside the running containers of hot reload-enabled services when those files or directories are modified. Applies to this module's services, and to services with this module as their `sourceModule`.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.hotReload.sync[]`

[module](container.md#module) &gt; [hotReload](container.md#module.hotreload) &gt; sync

Specify one or more source files or directories to automatically sync into the running container.

| Type | Required |
| :--- | :--- |
| `array[object]` | Yes |

### `module.hotReload.sync[].source`

[module](container.md#module) &gt; [hotReload](container.md#module.hotreload) &gt; [sync](container.md#module.hotreload.sync[]) &gt; source

POSIX-style path of the directory to sync to the target, relative to the module's top-level directory. Must be a relative path if provided. Defaults to the module's top-level directory if no value is provided.

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
module:
  ...
  hotReload:
    ...
    sync:
      - source: "src"
```

### `module.hotReload.sync[].target`

[module](container.md#module) &gt; [hotReload](container.md#module.hotreload) &gt; [sync](container.md#module.hotreload.sync[]) &gt; target

POSIX-style absolute path to sync the directory to inside the container. The root path \(i.e. "/"\) is not allowed.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

Example:

```yaml
module:
  ...
  hotReload:
    ...
    sync:
      - target: "/app/src"
```

### `module.dockerfile`

[module](container.md#module) &gt; dockerfile

POSIX-style name of Dockerfile, relative to project root. Defaults to $MODULE\_ROOT/Dockerfile.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.services[]`

[module](container.md#module) &gt; services

The list of services to deploy from this container module.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.services[].name`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; name

Valid RFC1035/RFC1123 \(DNS\) label \(may contain lowercase letters, numbers and dashes, must start with a letter, and cannot end with a dash\), cannot contain consecutive dashes or start with `garden`, or be longer than 63 characters.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.services[].dependencies[]`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; dependencies

The names of any services that this service depends on at runtime, and the names of any tasks that should be executed before this service is deployed.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.services[].args[]`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; args

The arguments to run the container with when starting the service.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.services[].daemon`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; daemon

Whether to run the service as a daemon \(to ensure only one runs per node\).

| Type | Required |
| :--- | :--- |
| `boolean` | No |

### `module.services[].ingresses[]`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; ingresses

List of ingress endpoints that the service exposes.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

Example:

```yaml
module:
  ...
  services:
    - ingresses:
      - path: /api
        port: http
```

### `module.services[].ingresses[].hostname`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ingresses](container.md#module.services[].ingresses[]) &gt; hostname

The hostname that should route to this service. Defaults to the default hostname configured in the provider configuration.

Note that if you're developing locally you may need to add this hostname to your hosts file.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.services[].ingresses[].path`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ingresses](container.md#module.services[].ingresses[]) &gt; path

The path which should be routed to the service.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.services[].ingresses[].port`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ingresses](container.md#module.services[].ingresses[]) &gt; port

The name of the container port where the specified paths should be routed.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.services[].env`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; env

Key/value map of environment variables. Keys must be valid POSIX environment variable names \(must not start with `GARDEN`\) and values must be primitives.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.services[].healthCheck`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; healthCheck

Specify how the service's health should be checked after deploying.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.services[].healthCheck.httpGet`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [healthCheck](container.md#module.services[].healthcheck) &gt; httpGet

Set this to check the service's health by making an HTTP request.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.services[].healthCheck.httpGet.path`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [healthCheck](container.md#module.services[].healthcheck) &gt; [httpGet](container.md#module.services[].healthcheck.httpget) &gt; path

The path of the service's health check endpoint.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.services[].healthCheck.httpGet.port`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [healthCheck](container.md#module.services[].healthcheck) &gt; [httpGet](container.md#module.services[].healthcheck.httpget) &gt; port

The name of the port where the service's health check endpoint should be available.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.services[].healthCheck.httpGet.scheme`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [healthCheck](container.md#module.services[].healthcheck) &gt; [httpGet](container.md#module.services[].healthcheck.httpget) &gt; scheme

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.services[].healthCheck.command[]`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [healthCheck](container.md#module.services[].healthcheck) &gt; command

Set this to check the service's health by running a command in its container.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.services[].healthCheck.tcpPort`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [healthCheck](container.md#module.services[].healthcheck) &gt; tcpPort

Set this to check the service's health by checking if this TCP port is accepting connections.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.services[].hotReloadArgs[]`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; hotReloadArgs

If this module uses the `hotReload` field, the container will be run with these arguments instead of those in `args` when the service is deployed with hot reloading enabled.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.services[].ports[]`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; ports

List of ports that the service container exposes.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.services[].ports[].name`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ports](container.md#module.services[].ports[]) &gt; name

The name of the port \(used when referencing the port elsewhere in the service configuration\).

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.services[].ports[].protocol`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ports](container.md#module.services[].ports[]) &gt; protocol

The protocol of the port.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.services[].ports[].containerPort`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ports](container.md#module.services[].ports[]) &gt; containerPort

The port exposed on the container by the running procces. This will also be the default value for `servicePort`. `servicePort:80 -> containerPort:8080 -> process:8080`

| Type | Required |
| :--- | :--- |
| `number` | Yes |

Example:

```yaml
module:
  ...
  services:
    - ports:
        - containerPort: "8080"
```

### `module.services[].ports[].servicePort`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ports](container.md#module.services[].ports[]) &gt; servicePort

The port exposed on the service. Defaults to `containerPort` if not specified. `servicePort:80 -> containerPort:8080 -> process:8080`

| Type | Required |
| :--- | :--- |
| `number` | No |

Example:

```yaml
module:
  ...
  services:
    - ports:
        - servicePort: "80"
```

### `module.services[].ports[].hostPort`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ports](container.md#module.services[].ports[]) &gt; hostPort

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.services[].ports[].nodePort`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [ports](container.md#module.services[].ports[]) &gt; nodePort

Set this to expose the service on the specified port on the host node \(may not be supported by all providers\).

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.services[].volumes[]`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; volumes

List of volumes that should be mounted when deploying the container.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.services[].volumes[].name`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [volumes](container.md#module.services[].volumes[]) &gt; name

The name of the allocated volume.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.services[].volumes[].containerPath`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [volumes](container.md#module.services[].volumes[]) &gt; containerPath

The path where the volume should be mounted in the container.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.services[].volumes[].hostPath`

[module](container.md#module) &gt; [services](container.md#module.services[]) &gt; [volumes](container.md#module.services[].volumes[]) &gt; hostPath

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.tests[]`

[module](container.md#module) &gt; tests

A list of tests to run in the module.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.tests[].name`

[module](container.md#module) &gt; [tests](container.md#module.tests[]) &gt; name

The name of the test.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.tests[].dependencies[]`

[module](container.md#module) &gt; [tests](container.md#module.tests[]) &gt; dependencies

The names of any services that must be running, and the names of any tasks that must be executed, before the test is run.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tests[].timeout`

[module](container.md#module) &gt; [tests](container.md#module.tests[]) &gt; timeout

Maximum duration \(in seconds\) of the test run.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.tests[].args[]`

[module](container.md#module) &gt; [tests](container.md#module.tests[]) &gt; args

The arguments used to run the test inside the container.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

Example:

```yaml
module:
  ...
  tests:
    - args:
      - npm
      - test
```

### `module.tests[].env`

[module](container.md#module) &gt; [tests](container.md#module.tests[]) &gt; env

Key/value map of environment variables. Keys must be valid POSIX environment variable names \(must not start with `GARDEN`\) and values must be primitives.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.tasks[]`

[module](container.md#module) &gt; tasks

A list of tasks that can be run from this container module. These can be used as dependencies for services \(executed before the service is deployed\) or for other tasks.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.tasks[].name`

[module](container.md#module) &gt; [tasks](container.md#module.tasks[]) &gt; name

The name of the task.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.tasks[].description`

[module](container.md#module) &gt; [tasks](container.md#module.tasks[]) &gt; description

A description of the task.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.tasks[].dependencies[]`

[module](container.md#module) &gt; [tasks](container.md#module.tasks[]) &gt; dependencies

The names of any tasks that must be executed, and the names of any services that must be running, before this task is executed.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tasks[].timeout`

[module](container.md#module) &gt; [tasks](container.md#module.tasks[]) &gt; timeout

Maximum duration \(in seconds\) of the task's execution.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.tasks[].args[]`

[module](container.md#module) &gt; [tasks](container.md#module.tasks[]) &gt; args

The arguments used to run the task inside the container.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

Example:

```yaml
module:
  ...
  tasks:
    - args:
      - rake
      - 'db:migrate'
```

## Complete YAML schema

```yaml
module:
  buildArgs: {}
  image:
  hotReload:
    sync:
      - source: .
        target:
  dockerfile:
  services:
    - name:
      dependencies: []
      args:
      daemon: false
      ingresses:
        - hostname:
          path: /
          port:
      env: {}
      healthCheck:
        httpGet:
          path:
          port:
          scheme: HTTP
        command:
        tcpPort:
      hotReloadArgs:
      ports:
        - name:
          protocol: TCP
          containerPort:
          servicePort: <containerPort>
          hostPort:
          nodePort:
      volumes:
        - name:
          containerPath:
          hostPath:
  tests:
    - name:
      dependencies: []
      timeout: null
      args:
      env: {}
  tasks:
    - name:
      description:
      dependencies: []
      timeout: null
      args:
```


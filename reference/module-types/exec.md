# Exec

Below is the schema reference for the `exec` module type. For an introduction to configuring Garden modules, please look at our [Configuration guide](../../using-garden/configuration-files.md).

The reference is divided into two sections. The [first section](exec.md#configuration-keys) lists and describes the available schema keys. The [second section](exec.md#complete-yaml-schema) contains the complete YAML schema.

## Configuration keys

### `module`

The module specification for an exec module.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.env`

[module](exec.md#module) &gt; env

Key/value map of environment variables. Keys must be valid POSIX environment variable names \(must not start with `GARDEN`\) and values must be primitives.

| Type | Required |
| :--- | :--- |
| `object` | No |

### `module.tasks[]`

[module](exec.md#module) &gt; tasks

A list of tasks that can be run in this module.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.tasks[].name`

[module](exec.md#module) &gt; [tasks](exec.md#module.tasks[]) &gt; name

The name of the task.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.tasks[].description`

[module](exec.md#module) &gt; [tasks](exec.md#module.tasks[]) &gt; description

A description of the task.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `module.tasks[].dependencies[]`

[module](exec.md#module) &gt; [tasks](exec.md#module.tasks[]) &gt; dependencies

The names of any tasks that must be executed, and the names of any services that must be running, before this task is executed.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tasks[].timeout`

[module](exec.md#module) &gt; [tasks](exec.md#module.tasks[]) &gt; timeout

Maximum duration \(in seconds\) of the task's execution.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.tasks[].command[]`

[module](exec.md#module) &gt; [tasks](exec.md#module.tasks[]) &gt; command

The command to run in the module build context.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tests[]`

[module](exec.md#module) &gt; tests

A list of tests to run in the module.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `module.tests[].name`

[module](exec.md#module) &gt; [tests](exec.md#module.tests[]) &gt; name

The name of the test.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

### `module.tests[].dependencies[]`

[module](exec.md#module) &gt; [tests](exec.md#module.tests[]) &gt; dependencies

The names of any services that must be running, and the names of any tasks that must be executed, before the test is run.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tests[].timeout`

[module](exec.md#module) &gt; [tests](exec.md#module.tests[]) &gt; timeout

Maximum duration \(in seconds\) of the test run.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `module.tests[].command[]`

[module](exec.md#module) &gt; [tests](exec.md#module.tests[]) &gt; command

The command to run in the module build context in order to test it.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

### `module.tests[].env`

[module](exec.md#module) &gt; [tests](exec.md#module.tests[]) &gt; env

Key/value map of environment variables. Keys must be valid POSIX environment variable names \(must not start with `GARDEN`\) and values must be primitives.

| Type | Required |
| :--- | :--- |
| `object` | No |

## Complete YAML schema

```yaml
module:
  env: {}
  tasks:
    - name:
      description:
      dependencies: []
      timeout: null
      command:
  tests:
    - name:
      dependencies: []
      timeout: null
      command:
      env: {}
```


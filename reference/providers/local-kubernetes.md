# Local Kubernetes

Below is the schema reference for the `local-kubernetes` provider. For an introduction to configuring a Garden project with providers, please look at our [configuration guide](../../using-garden/configuration-files.md).

The reference is divided into two sections. The [first section](local-kubernetes.md#configuration-keys) lists and describes the available schema keys. The [second section](local-kubernetes.md#complete-yaml-schema) contains the complete YAML schema.

## Configuration keys

### `project`

| Type | Required |
| :--- | :--- |
| `object` | No |

### `project.environments[]`

[project](local-kubernetes.md#project) &gt; environments

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[]`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; providers

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[].name`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; name

The name of the provider plugin to use.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - name: "local-kubernetes"
```

### `project.environments[].providers[].defaultHostname`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; defaultHostname

A default hostname to use when no hostname is explicitly configured for a service.

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - defaultHostname: "api.mydomain.com"
```

### `project.environments[].providers[].defaultUsername`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; defaultUsername

Set a default username \(used for namespacing within a cluster\).

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].forceSsl`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; forceSsl

Require SSL on all services. If set to true, an error is raised when no certificate is available for a configured hostname.

| Type | Required |
| :--- | :--- |
| `boolean` | No |

### `project.environments[].providers[].imagePullSecrets[]`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; imagePullSecrets

References to `docker-registry` secrets to use for authenticating with remote registries when pulling images. This is necessary if you reference private images in your module configuration, and is required when configuring a remote Kubernetes environment.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[].imagePullSecrets[].name`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; [imagePullSecrets](local-kubernetes.md#project.environments[].providers[].imagepullsecrets[]) &gt; name

The name of the Kubernetes secret.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - imagePullSecrets:
            - name: "my-secret"
```

### `project.environments[].providers[].imagePullSecrets[].namespace`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; [imagePullSecrets](local-kubernetes.md#project.environments[].providers[].imagepullsecrets[]) &gt; namespace

The namespace where the secret is stored. If necessary, the secret may be copied to the appropriate namespace before use.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].tlsCertificates[]`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; tlsCertificates

One or more certificates to use for ingress.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[].tlsCertificates[].name`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](local-kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; name

A unique identifier for this certificate.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - tlsCertificates:
            - name: "wildcard"
```

### `project.environments[].providers[].tlsCertificates[].hostnames[]`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](local-kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; hostnames

A list of hostnames that this certificate should be used for. If you don't specify these, they will be automatically read from the certificate.

| Type | Required |
| :--- | :--- |
| `array[string]` | No |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - tlsCertificates:
            - hostnames:
              - www.mydomain.com
```

### `project.environments[].providers[].tlsCertificates[].secretRef`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](local-kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; secretRef

A reference to the Kubernetes secret that contains the TLS certificate and key for the domain.

| Type | Required |
| :--- | :--- |
| `object` | No |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - tlsCertificates:
            - secretRef:
              name: my-tls-secret
              namespace: default
```

### `project.environments[].providers[].tlsCertificates[].secretRef.name`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](local-kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; [secretRef](local-kubernetes.md#project.environments[].providers[].tlscertificates[].secretref) &gt; name

The name of the Kubernetes secret.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - tlsCertificates:
            - secretRef:
              name: my-tls-secret
              namespace: default
                ...
                name: "my-secret"
```

### `project.environments[].providers[].tlsCertificates[].secretRef.namespace`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](local-kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; [secretRef](local-kubernetes.md#project.environments[].providers[].tlscertificates[].secretref) &gt; namespace

The namespace where the secret is stored. If necessary, the secret may be copied to the appropriate namespace before use.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].namespace`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; namespace

Specify which namespace to deploy services to \(defaults to the project name\). Note that the framework generates other namespaces as well with this name as a prefix.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].setupIngressController`

[project](local-kubernetes.md#project) &gt; [environments](local-kubernetes.md#project.environments[]) &gt; [providers](local-kubernetes.md#project.environments[].providers[]) &gt; setupIngressController

Set this to null or false to skip installing/enabling the `nginx` ingress controller.

| Type | Required |
| :--- | :--- |
| `string` | No |

## Complete YAML schema

```yaml
project:
  environments:
    - providers:
        - name:
          defaultHostname:
          defaultUsername:
          forceSsl: false
          imagePullSecrets:
            - name:
              namespace: default
          tlsCertificates:
            - name:
              hostnames:
              secretRef:
                name:
                namespace: default
          namespace:
          setupIngressController: nginx
```


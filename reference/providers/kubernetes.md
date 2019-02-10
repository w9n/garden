# Kubernetes

Below is the schema reference for the `kubernetes` provider. For an introduction to configuring a Garden project with providers, please look at our [configuration guide](../../using-garden/configuration-files.md).

The reference is divided into two sections. The [first section](kubernetes.md#configuration-keys) lists and describes the available schema keys. The [second section](kubernetes.md#complete-yaml-schema) contains the complete YAML schema.

## Configuration keys

### `project`

| Type | Required |
| :--- | :--- |
| `object` | No |

### `project.environments[]`

[project](kubernetes.md#project) &gt; environments

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[]`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; providers

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[].defaultHostname`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; defaultHostname

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

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; defaultUsername

Set a default username \(used for namespacing within a cluster\).

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].forceSsl`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; forceSsl

Require SSL on all services. If set to true, an error is raised when no certificate is available for a configured hostname.

| Type | Required |
| :--- | :--- |
| `boolean` | No |

### `project.environments[].providers[].imagePullSecrets[]`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; imagePullSecrets

References to `docker-registry` secrets to use for authenticating with remote registries when pulling images. This is necessary if you reference private images in your module configuration, and is required when configuring a remote Kubernetes environment.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[].imagePullSecrets[].name`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [imagePullSecrets](kubernetes.md#project.environments[].providers[].imagepullsecrets[]) &gt; name

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

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [imagePullSecrets](kubernetes.md#project.environments[].providers[].imagepullsecrets[]) &gt; namespace

The namespace where the secret is stored. If necessary, the secret may be copied to the appropriate namespace before use.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].tlsCertificates[]`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; tlsCertificates

One or more certificates to use for ingress.

| Type | Required |
| :--- | :--- |
| `array[object]` | No |

### `project.environments[].providers[].tlsCertificates[].name`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; name

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

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; hostnames

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

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; secretRef

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

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; [secretRef](kubernetes.md#project.environments[].providers[].tlscertificates[].secretref) &gt; name

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

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [tlsCertificates](kubernetes.md#project.environments[].providers[].tlscertificates[]) &gt; [secretRef](kubernetes.md#project.environments[].providers[].tlscertificates[].secretref) &gt; namespace

The namespace where the secret is stored. If necessary, the secret may be copied to the appropriate namespace before use.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].name`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; name

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
        - name: "kubernetes"
```

### `project.environments[].providers[].context`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; context

The kubectl context to use to connect to the Kubernetes cluster.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - context: "my-dev-context"
```

### `project.environments[].providers[].deploymentRegistry`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; deploymentRegistry

The registry where built containers should be pushed to, and then pulled to the cluster when deploying services.

| Type | Required |
| :--- | :--- |
| `object` | Yes |

### `project.environments[].providers[].deploymentRegistry.hostname`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [deploymentRegistry](kubernetes.md#project.environments[].providers[].deploymentregistry) &gt; hostname

The hostname \(and optionally port, if not the default port\) of the registry.

| Type | Required |
| :--- | :--- |
| `string` | Yes |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - deploymentRegistry:
            ...
            hostname: "gcr.io"
```

### `project.environments[].providers[].deploymentRegistry.port`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [deploymentRegistry](kubernetes.md#project.environments[].providers[].deploymentregistry) &gt; port

The port where the registry listens on, if not the default.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `project.environments[].providers[].deploymentRegistry.namespace`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; [deploymentRegistry](kubernetes.md#project.environments[].providers[].deploymentregistry) &gt; namespace

The namespace in the registry where images should be pushed.

| Type | Required |
| :--- | :--- |
| `string` | No |

Example:

```yaml
project:
  ...
  environments:
    - providers:
        - deploymentRegistry:
            ...
            namespace: "my-project"
```

### `project.environments[].providers[].ingressClass`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; ingressClass

The ingress class to use on configured Ingresses \(via the `kubernetes.io/ingress.class` annotation\) when deploying `container` services. Use this if you have multiple ingress controllers in your cluster.

| Type | Required |
| :--- | :--- |
| `string` | No |

### `project.environments[].providers[].ingressHttpPort`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; ingressHttpPort

The external HTTP port of the cluster's ingress controller.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `project.environments[].providers[].ingressHttpsPort`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; ingressHttpsPort

The external HTTPS port of the cluster's ingress controller.

| Type | Required |
| :--- | :--- |
| `number` | No |

### `project.environments[].providers[].namespace`

[project](kubernetes.md#project) &gt; [environments](kubernetes.md#project.environments[]) &gt; [providers](kubernetes.md#project.environments[].providers[]) &gt; namespace

Specify which namespace to deploy services to \(defaults to --\). Note that the framework generates other namespaces as well with this name as a prefix.

| Type | Required |
| :--- | :--- |
| `string` | No |

## Complete YAML schema

```yaml
project:
  environments:
    - providers:
        - defaultHostname:
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
          name:
          context:
          deploymentRegistry:
            hostname:
            port:
            namespace: _
          ingressClass:
          ingressHttpPort: 80
          ingressHttpsPort: 443
          namespace:
```


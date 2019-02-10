# Quick Start

This guide will walk you through setting up the Garden framework. It assumes you already have Garden installed. If you don't, please check out our [installation guide](installation.md).

## Using the CLI

With the CLI installed, we can now try out a few commands using the [Simple Project](../examples/simple-project.md) from our [example projects](../examples/). The example project consists of a couple of simple modules, each defining one service.

_Note: Check if Kubernetes is running with_ `kubectl version`_. You should see both a_ `Client Version` _and a_ `Server Version` _in the response. If not, please start it up before proceeding._

Clone the repo and change into the `simple-project` directory:

```bash
$ git clone https://github.com/garden-io/garden.git
$ cd garden/examples/simple-project
```

First, let's check the environment status by running the following from the project root:

```bash
$ garden get status
```

The response tells us how the environment is configured and the status of the providers. Next, we'll build our modules with:

```bash
$ garden build
```

This builds Docker images for `go-service` and `node-service` respectively. Next, we'll deploy the services with:

```bash
$ garden deploy
```

And that's it! The `garden build` step above is actually unnecessary \(only included here for clarity\), since `garden deploy` will also rebuild modules as needed. The services are now running on the Garden framework. You can see for yourself by querying the `/hello` endpoint of `go-service`'s running container:

```bash
$ garden call go-service/hello-go
```

To run tests for all modules:

```bash
$ garden test
```

And if you prefer an all-in-one command that watches your project for changes and re-builds, re-deploys, and re-tests automatically, try:

```bash
$ garden dev
```

Go ahead, leave it running and change one of the files in the project, then watch it re-build.

That's it for now. Check out our [Using Garden](../using-garden/) section for other features like hot reload, remote clusters, integration tests, and lots more.

To see how a Garden project is configured from scratch check, out the [Simple Project](../examples/simple-project.md) guide for a more in-depth presentation.


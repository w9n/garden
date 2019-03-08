# Spring Boot example project

This example demonstrates Spring Boot running inside a Docker container (managed by a local Kubernetes cluster) with Spring Boot's dev tools enabled. We'll walk through live-restarting a Spring Boot service on compilation via Garden's hot reload functionality.

## Prerequisites

You'll need to have Java and [Maven](https://maven.apache.org/install.html) installed (follow the appropriate installation instructions for your platform).

## Overview

This project consists of a single module (in the `devtools` directory), which is a minimally modified version of the [Spring Boot devtools sample project found here](https://github.com/spring-projects/spring-boot/tree/master/spring-boot-samples/spring-boot-sample-devtools).

We've changed the parent pom from `spring-boot-samples` to `spring-boot-starter-parent`

```sh
garden deploy --hot=devtools
```

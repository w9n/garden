import { expect } from "chai"
import * as td from "testdouble"
import { join, resolve } from "path"
import { Garden } from "../../../src/garden"
import {
  dataDir,
  expectError,
  makeTestGarden,
  makeTestGardenA,
  projectRootA,
  stubExtSources,
  getDataDir,
  cleanProject,
  stubGitCli,
  testModuleVersion,
} from "../../helpers"
import { getNames } from "../../../src/util/util"
import { MOCK_CONFIG } from "../../../src/cli/cli"
import { LinkedSource } from "../../../src/config-store"
import { ModuleVersion } from "../../../src/vcs/vcs"
import { hashRepoUrl } from "../../../src/util/ext-source-util"
import { getModuleCacheContext } from "../../../src/types/module"

describe("Garden", () => {
  beforeEach(async () => {
    td.replace(Garden.prototype, "resolveVersion", async () => testModuleVersion)
  })

  describe("factory", () => {
    it("should throw when initializing with missing plugins", async () => {
      await expectError(async () => await Garden.factory(projectRootA), "configuration")
    })

    it("should initialize and add the action handlers for a plugin", async () => {
      const garden = await makeTestGardenA()
      const actions = await garden.getActionHandler()

      expect((<any>actions).actionHandlers.prepareEnvironment["test-plugin"]).to.be.ok
      expect((<any>actions).actionHandlers.prepareEnvironment["test-plugin-b"]).to.be.ok
    })

    it("should initialize with MOCK_CONFIG", async () => {
      const garden = await Garden.factory("./", { config: MOCK_CONFIG })
      expect(garden).to.be.ok
    })

    it("should parse and resolve the config from the project root", async () => {
      const garden = await makeTestGardenA()
      const projectRoot = garden.projectRoot

      expect(garden.projectName).to.equal("test-project-a")

      expect(await garden.resolveProviders()).to.equal([
        {
          name: "exec",
          config: {
            name: "exec",
            path: projectRoot,
          },
          dependencies: [],
          moduleConfigs: [],
        },
        {
          name: "container",
          config: {
            name: "container",
            path: projectRoot,
          },
          dependencies: [],
          moduleConfigs: [],
        },
        {
          name: "test-plugin",
          config: {
            name: "test-plugin",
            environments: ["local"],
            path: projectRoot,
          },
          dependencies: [],
          moduleConfigs: [],
        },
        {
          name: "test-plugin-b",
          config: {
            name: "test-plugin-b",
            environments: ["local"],
            path: projectRoot,
          },
          dependencies: [],
          moduleConfigs: [],
        },
      ])

      expect(garden.variables).to.eql({
        some: "variable",
      })
    })

    it("should resolve templated env variables in project config", async () => {
      process.env.TEST_PROVIDER_TYPE = "test-plugin"
      process.env.TEST_VARIABLE = "banana"

      const projectRoot = join(__dirname, "..", "data", "test-project-templated")

      const garden = await makeTestGarden(projectRoot)

      delete process.env.TEST_PROVIDER_TYPE
      delete process.env.TEST_VARIABLE

      expect(await garden.resolveProviders()).to.equal([
        {
          name: "exec",
          config: {
            name: "exec",
            path: projectRoot,
          },
          dependencies: [],
          moduleConfigs: [],
        },
        {
          name: "container",
          config: {
            name: "container",
            path: projectRoot,
          },
          dependencies: [],
          moduleConfigs: [],
        },
        {
          name: "test-plugin",
          config: {
            name: "test-plugin",
            path: projectRoot,
          },
          dependencies: [],
          moduleConfigs: [],
        },
      ])

      expect(garden.variables).to.eql({
        "some": "banana",
        "service-a-build-command": "OK",
      })
    })

    it("should throw if the specified environment isn't configured", async () => {
      await expectError(async () => Garden.factory(projectRootA, { environmentName: "bla" }), "parameter")
    })

    it("should throw if environment starts with 'garden-'", async () => {
      await expectError(async () => Garden.factory(projectRootA, { environmentName: "garden-bla" }), "parameter")
    })

    it("should throw if no provider is configured for the environment", async () => {
      await expectError(async () => Garden.factory(projectRootA, { environmentName: "other" }), "configuration")
    })

    it("should throw if plugin module exports invalid name", async () => {
      const pluginPath = join(dataDir, "plugins", "invalid-exported-name.ts")
      const plugins = { foo: pluginPath }
      const projectRoot = join(dataDir, "test-project-empty")
      await expectError(async () => Garden.factory(projectRoot, { plugins }), "plugin")
    })

    it("should throw if plugin module name is not a valid identifier", async () => {
      const pluginPath = join(dataDir, "plugins", "invalidModuleName.ts")
      const plugins = { foo: pluginPath }
      const projectRoot = join(dataDir, "test-project-empty")
      await expectError(async () => Garden.factory(projectRoot, { plugins }), "plugin")
    })

    it("should throw if plugin module doesn't contain factory function", async () => {
      const pluginPath = join(dataDir, "plugins", "missing-factory.ts")
      const plugins = { foo: pluginPath }
      const projectRoot = join(dataDir, "test-project-empty")
      await expectError(async () => Garden.factory(projectRoot, { plugins }), "plugin")
    })
  })

  describe("resolveProviderConfigs", () => {
    it("should include the module's relative path in the error message for invalid config", async () => {
      throw new Error("TODO")
      // const projectPath = resolve(dataDir, "test-project-invalid-config")
      // await expectError(
      //   async () => await loadConfig(projectPath, resolve(projectPath, "invalid-config-module")),
      //   (err) => {
      //     expect(err.message).to.match(/invalid-config-module\/garden.yml/)
      //   })
    })

    it("should pass through a basic provider config", async () => {
      throw new Error("TODO")
    })

    it("should call a configureProvider handler if applicable", async () => {
      throw new Error("TODO")
    })

    it("should give a readable error if provider configs have invalid template strings", async () => {
      throw new Error("TODO")
    })

    it("should give a readable error if providers reference non-existent providers", async () => {
      throw new Error("TODO")
    })

    it("should add plugin modules if returned by the provider", async () => {
      throw new Error("TODO")
    })

    it("should throw if plugins have declared circular dependencies", async () => {
      throw new Error("TODO")
    })

    it("should throw if provider configs have implicit circular dependencies", async () => {
      throw new Error("TODO")
    })

    it("should apply default values from a plugin's configuration schema is specified", async () => {
      throw new Error("TODO")
    })

    it("should throw if a config doesn't match a plugin's configuration schema", async () => {
      throw new Error("TODO")
    })
  })

  describe("scanModules", () => {
    // TODO: assert that gitignore in project root is respected
    it("should scan the project root for modules and add to the context", async () => {
      const garden = await makeTestGardenA()
      await garden.scanModules()

      const modules = await garden.resolveModuleConfigs()
      expect(getNames(modules).sort()).to.eql(["module-a", "module-b", "module-c"])
    })

    it("should scan and add modules for projects with configs defining multiple modules", async () => {
      const garden = await makeTestGarden(resolve(dataDir, "test-project-multiple-module-config"))
      await garden.scanModules()

      const modules = await garden.resolveModuleConfigs()
      expect(getNames(modules).sort()).to.eql([
        "module-a1",
        "module-a2",
        "module-b1",
        "module-b2",
        "module-c",
        "module-from-project-config",
      ])
    })

    it("should scan and add modules for projects with external project sources", async () => {
      const garden = await makeTestGarden(resolve(dataDir, "test-project-ext-project-sources"))

      const getRemoteSourcePath = td.replace(garden.vcs, "getRemoteSourcePath")
      td.when(getRemoteSourcePath("source-a"), { ignoreExtraArgs: true })
        .thenReturn(join("mock-dot-garden", "sources", "project", "source-a"))
      td.when(getRemoteSourcePath("source-b"), { ignoreExtraArgs: true })
        .thenReturn(join("mock-dot-garden", "sources", "project", "source-b"))
      td.when(getRemoteSourcePath("source-c"), { ignoreExtraArgs: true })
        .thenReturn(join("mock-dot-garden", "sources", "project", "source-c"))
      stubExtSources(garden)

      await garden.scanModules()

      const modules = await garden.resolveModuleConfigs()
      expect(getNames(modules).sort()).to.eql(["module-a", "module-b", "module-c"])
    })

    it("should throw when two modules have the same name", async () => {
      const garden = await makeTestGarden(resolve(dataDir, "test-projects", "duplicate-module"))

      await expectError(
        () => garden.scanModules(),
        err => expect(err.message).to.equal(
          "Module module-a is declared multiple times (in 'module-a/garden.yml' and 'module-b/garden.yml')",
        ),
      )
    })
  })

  describe("loadModuleConfigs", () => {
    it("should resolve module by absolute path", async () => {
      const garden = await makeTestGardenA()
      const path = join(projectRootA, "module-a")

      const module = (await (<any>garden).loadModuleConfigs(path))[0]
      expect(module!.name).to.equal("module-a")
    })

    it("should resolve module by relative path to project root", async () => {
      const garden = await makeTestGardenA()

      const module = (await (<any>garden).loadModuleConfigs("./module-a"))[0]
      expect(module!.name).to.equal("module-a")
    })

    it("should resolve module path to external sources dir if module has a remote source", async () => {
      const projectRoot = resolve(dataDir, "test-project-ext-module-sources")
      const garden = await makeTestGarden(projectRoot)
      stubGitCli(garden)

      const module = (await (<any>garden).loadModuleConfigs("./module-a"))[0]
      const repoUrlHash = hashRepoUrl(module!.repositoryUrl!)

      expect(module!.path).to.equal(join(projectRoot, ".garden", "sources", "module", `module-a--${repoUrlHash}`))
    })

    it("should set default values properly", async () => {
      throw new Error("TODO")
    })
  })

  describe("resolveModuleConfigs", () => {
    it("should throw if a module references itself in a template string", async () => {
      const projectRoot = resolve(dataDir, "test-projects", "module-self-ref")
      const garden = await makeTestGarden(projectRoot)
      await expectError(
        () => garden.resolveModuleConfigs(),
        (err) => expect(err.message).to.equal(
          "Circular reference detected when resolving key modules.module-a (from modules.module-a)",
        ),
      )
    })
  })

  describe("resolveVersion", () => {
    beforeEach(() => td.reset())

    it("should return result from cache if available", async () => {
      const garden = await makeTestGardenA()
      const module = await garden.resolveModuleConfig("module-a")
      const version: ModuleVersion = {
        versionString: "banana",
        dependencyVersions: {},
        files: [],
      }
      garden.cache.set(["moduleVersions", module.name], version, getModuleCacheContext(module))

      const result = await garden.resolveVersion("module-a", [])

      expect(result).to.eql(version)
    })

    it("should otherwise return version from VCS handler", async () => {
      const garden = await makeTestGardenA()
      await garden.scanModules()

      garden.cache.delete(["moduleVersions", "module-b"])

      const resolveStub = td.replace(garden.vcs, "resolveVersion")
      const version: ModuleVersion = {
        versionString: "banana",
        dependencyVersions: {},
        files: [],
      }

      td.when(resolveStub(), { ignoreExtraArgs: true }).thenResolve(version)

      const result = await garden.resolveVersion("module-b", [])

      expect(result).to.eql(version)
    })

    it("should ignore cache if force=true", async () => {
      const garden = await makeTestGardenA()
      const module = await garden.resolveModuleConfig("module-a")
      const version: ModuleVersion = {
        versionString: "banana",
        dependencyVersions: {},
        files: [],
      }
      garden.cache.set(["moduleVersions", module.name], version, getModuleCacheContext(module))

      const result = await garden.resolveVersion("module-a", [], true)

      expect(result).to.not.eql(version)
    })
  })

  describe("loadExtSourcePath", () => {
    let projectRoot: string

    const makeGarden = async (root) => {
      const garden = await makeTestGarden(root)
      stubGitCli(garden)
      return garden
    }

    afterEach(async () => {
      if (projectRoot) {
        await cleanProject(projectRoot)
      }
    })

    it("should return the path to the project source if source type is project", async () => {
      projectRoot = getDataDir("test-project-ext-project-sources")
      const garden = await makeGarden(projectRoot)
      const repositoryUrl = "https://github.com/org/repo.git#master"
      const path = await garden.loadExtSourcePath({ repositoryUrl, name: "source-a", sourceType: "project" })
      const repoUrlHash = hashRepoUrl(repositoryUrl)
      expect(path).to.equal(join(projectRoot, ".garden", "sources", "project", `source-a--${repoUrlHash}`))
    })

    it("should return the path to the module source if source type is module", async () => {
      projectRoot = getDataDir("test-project-ext-module-sources")
      const garden = await makeGarden(projectRoot)
      const repositoryUrl = "https://github.com/org/repo.git#master"
      const path = await garden.loadExtSourcePath({ repositoryUrl, name: "module-a", sourceType: "module" })
      const repoUrlHash = hashRepoUrl(repositoryUrl)
      expect(path).to.equal(join(projectRoot, ".garden", "sources", "module", `module-a--${repoUrlHash}`))
    })

    it("should return the local path of the project source if linked", async () => {
      projectRoot = getDataDir("test-project-ext-project-sources")
      const garden = await makeGarden(projectRoot)
      const localPath = join(projectRoot, "mock-local-path", "source-a")

      const linked: LinkedSource[] = [{
        name: "source-a",
        path: localPath,
      }]
      await garden.configStore.set(["linkedProjectSources"], linked)

      const path = await garden.loadExtSourcePath({
        name: "source-a",
        repositoryUrl: "https://github.com/org/repo.git#master",
        sourceType: "project",
      })

      expect(path).to.equal(join(projectRoot, "mock-local-path", "source-a"))
    })

    it("should return the local path of the module source if linked", async () => {
      projectRoot = getDataDir("test-project-ext-module-sources")
      const garden = await makeGarden(projectRoot)
      const localPath = join(projectRoot, "mock-local-path", "module-a")

      const linked: LinkedSource[] = [{
        name: "module-a",
        path: localPath,
      }]
      await garden.configStore.set(["linkedModuleSources"], linked)

      const path = await garden.loadExtSourcePath({
        name: "module-a",
        repositoryUrl: "https://github.com/org/repo.git#master",
        sourceType: "module",
      })

      expect(path).to.equal(join(projectRoot, "mock-local-path", "module-a"))
    })
  })
})

import { dataDir, makeTestGarden, expectError } from "../../../../helpers"
import { resolve } from "path"
import { GetTestResultCommand } from "../../../../../src/commands/get/get-test-result"
import { expect } from "chai"

describe("GetTestResultCommand", () => {
  it("should not find module by module name", async () => {
    const name = "test-run"
    const module = "test-module"

    const garden = await makeTestGarden(
      resolve(dataDir, "test-project-dependants"),
    )
    const log = garden.log
    const command = new GetTestResultCommand()

    await expectError(
      async () =>
        await command.action({ garden, log, args: { name, module }, opts: {} }),
      "parameter",
    )
  })

  it("should find module", async () => {
    const name = "unit"
    const module = "module-c"

    const garden = await makeTestGarden(resolve(dataDir, "test-project-a"))
    const log = garden.log
    const command = new GetTestResultCommand()

    const res = await command.action({
      garden,
      log,
      args: { name, module },
      opts: {},
    })

    expect(res.result).to.exist

    if (res.result) {
      expect(res.result.output).to.be.null
      expect(res.result.name).to.equal(name)
      expect(res.result.module).to.equal(module)
    }
  })
})

import { dataDir, makeTestGarden, expectError } from "../../../../helpers"
import { resolve } from "path"
import { GetTaskResultCommand } from "../../../../../src/commands/get/get-task-result"
import { expect } from "chai"

describe("GetTaskResultCommand", () => {
  it("should not find module by module name", async () => {
    const name = "imaginary-task"

    const garden = await makeTestGarden(
      resolve(dataDir, "test-project-dependants"),
    )
    const log = garden.log
    const command = new GetTaskResultCommand()

    await expectError(
      async () =>
        await command.action({ garden, log, args: { name }, opts: {} }),
      "parameter",
    )
  })

  it("should find module", async () => {
    const name = "task-c"

    const garden = await makeTestGarden(resolve(dataDir, "test-project-a"))
    const log = garden.log
    const command = new GetTaskResultCommand()

    const res = await command.action({
      garden,
      log,
      args: { name },
      opts: {},
    })

    expect(res.result).to.exist

    if (res.result) {
      expect(res.result.output).to.be.null
      expect(res.result.name).to.equal(name)
    }
  })
})

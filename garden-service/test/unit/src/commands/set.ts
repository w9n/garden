import { expect } from "chai"
import { SetSecretCommand } from "../../../../src/commands/set"
import { makeTestGardenA } from "../../../helpers"

describe("SetSecretCommand", () => {
  const pluginName = "test-plugin"
  const provider = pluginName

  it("should set a config variable", async () => {
    const garden = await makeTestGardenA()
    const log = garden.log
    const command = new SetSecretCommand()

    await command.action({
      garden,
      log,
      args: { provider, key: "mykey", value: "myvalue" },
      opts: {},
    })

    const actions = await garden.getActionHandler()
    expect(await actions.getSecret({ log, pluginName, key: "mykey" })).to.eql({ value: "myvalue" })
  })
})

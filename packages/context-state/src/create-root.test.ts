import { describe, expect, it } from "vitest"
import { createRoot } from "./create-root"

describe("createRoot", () => {
  it("creates a root with no parameters", () => {
    const root = createRoot()

    expect(root.getValue).toThrow()
    root.run()
    expect(root.getValue()).toEqual(null)
  })

  it("creates an instantiable root", () => {
    const root = createRoot("rootKey").withTypes<null, string>()

    expect(() => root.getValue({ rootKey: "a" })).toThrow()
    const closeA = root.run("a")
    expect(root.getValue({ rootKey: "a" })).toEqual(null)

    expect(() => root.getValue({ rootKey: "b" })).toThrow()
    root.run("b")
    expect(root.getValue({ rootKey: "a" })).toEqual(null)
    expect(root.getValue({ rootKey: "b" })).toEqual(null)

    closeA()
    expect(() => root.getValue({ rootKey: "a" })).toThrow()
    expect(root.getValue({ rootKey: "b" })).toEqual(null)
  })

  it("stores the context with a single instance", () => {
    const root = createRoot().withTypes<{
      foo: string
    }>()

    root.run("", {
      foo: "bar",
    })
    expect(root.getValue()).toEqual({
      foo: "bar",
    })
  })

  it("stores the context on multiple instances", () => {
    const root = createRoot("root").withTypes<
      {
        foo: string
      },
      string
    >()

    root.run("a", {
      foo: "a",
    })
    root.run("b", {
      foo: "b",
    })
    expect(root.getValue({ root: "a" })).toEqual({
      foo: "a",
    })
    expect(root.getValue({ root: "b" })).toEqual({
      foo: "b",
    })
  })
})

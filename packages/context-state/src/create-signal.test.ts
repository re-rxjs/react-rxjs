import { describe, expect, it, vi } from "vitest"
import { createSignal } from "./create-signal"
import { createRoot } from "./create-root"

describe("createSignal", () => {
  it("creates a node that pushes the values coming from its push function", () => {
    const root = createRoot()
    const signal = createSignal<number, {}>(root)

    root.run()

    const next = vi.fn()
    signal.getSignal$().subscribe(next)
    expect(next).not.toBeCalled()

    signal.push(4)
    signal.push(5)
    expect(next).toBeCalledTimes(2)
    expect(next).toBeCalledWith(4)
    expect(next).toBeCalledWith(5)
  })

  it("doesn't repeat the latest emitted value to late observers", () => {
    const root = createRoot()
    const signal = createSignal<number, {}>(root)

    root.run()

    const nextA = vi.fn()
    signal.getSignal$().subscribe(nextA)

    signal.push(3)

    const nextB = vi.fn()
    signal.getSignal$().subscribe(nextB)

    signal.push(4)

    expect(nextA).toBeCalledTimes(2)
    expect(nextB).toBeCalledTimes(1)

    expect(nextB).toBeCalledWith(4)
  })

  it("throws an error if the node is not active", () => {
    const root = createRoot()
    const signal = createSignal<number, {}>(root)

    expect(() => signal.getSignal$()).toThrowError("Inactive Context")
  })

  it("respects instances as separate signals", () => {
    const root = createRoot("gameId")
    const signal = createSignal<number, { gameId: string }>(root)

    root.run("a")
    root.run("b")

    const nextA = vi.fn()
    signal.getSignal$({ gameId: "a" }).subscribe(nextA)

    const nextB = vi.fn()
    signal.getSignal$({ gameId: "b" }).subscribe(nextB)

    signal.push({ gameId: "a" }, 1)
    signal.push({ gameId: "b" }, 2)

    expect(nextA).toBeCalledTimes(1)
    expect(nextB).toBeCalledTimes(1)

    expect(nextA).toBeCalledWith(1)
    expect(nextB).toBeCalledWith(2)
  })

  it("throws an error if the instance doesn't exist", () => {
    const root = createRoot("gameId")
    const signal = createSignal<number, { gameId: string }>(root)

    const stop = root.run("a")

    expect(() => signal.getSignal$({ gameId: "b" })).toThrowError(
      "Inactive Context",
    )
    expect(() => signal.push({ gameId: "b" }, 3)).toThrowError(
      "Inactive Context",
    )
    stop()
    expect(() => signal.getSignal$({ gameId: "a" })).toThrowError(
      "Inactive Context",
    )
    expect(() => signal.push({ gameId: "a" }, 3)).toThrowError(
      "Inactive Context",
    )
  })

  it("activates even if it's declared after the parent was already active", () => {
    const root = createRoot()

    root.run()

    const signal = createSignal<number, {}>(root)
    const next = vi.fn()
    signal.getSignal$().subscribe(next)
    expect(next).not.toBeCalled()

    signal.push(4)
    signal.push(5)
    expect(next).toBeCalledTimes(2)
    expect(next).toBeCalledWith(4)
    expect(next).toBeCalledWith(5)
  })
})

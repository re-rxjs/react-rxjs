import { BehaviorSubject, of, Subject } from "rxjs"
import { describe, expect, it, vi } from "vitest"
import { combineStates } from "./combineStates"
import { createRoot } from "./create-root"
import { routeState } from "./route-state"
import { substate } from "./substate"
import { instanceNode } from "./test-utils/instance-node"
import { StateNode } from "./types"

describe("combineStates", () => {
  it("combines state nodes into one", () => {
    const root = createRoot()
    const nodeA = substate(root, () => of("a"))
    const nodeB = substate(root, () => of("b"))
    const nodeC = substate(root, () => of("c"))

    const combined = combineStates({ nodeA, nodeB, nodeC })
    root.run()

    expect(combined.getValue({ root: "" })).toEqual({
      nodeA: "a",
      nodeB: "b",
      nodeC: "c",
    })
  })

  it("substates can access the context of either branch", () => {
    const root = createRoot()
    const contextA = substate(root, () => of("context A"))
    const nodeA = substate(contextA, () => of("a"))
    const contextB = substate(root, () => of("context B"))
    const nodeB = substate(contextB, () => of("b"))

    const combined = combineStates({ nodeA, nodeB })
    const result: string[] = []
    substate(combined, (ctx) => {
      // Can't put assertions here because errors get captured and not emitted on globalThis
      result.push(ctx(contextA))
      result.push(ctx(contextB))
      return of("substate")
    })
    root.run()

    expect(result).toEqual(["context A", "context B"])
  })

  it("only activates if all branches are active", () => {
    function createActivableNode<K extends Record<string, any>>(
      root: StateNode<any, K>,
    ) {
      const ctxSource = new BehaviorSubject(false)
      const ctxNode = substate(root, () => ctxSource)
      const [, { node }] = routeState(
        ctxNode,
        {
          other: null,
          node: null,
        },
        (value) => (value ? "node" : "other"),
      )
      return [node, (active: boolean) => ctxSource.next(active)] as const
    }

    const root = createRoot()
    const [nodeA, activateA] = createActivableNode(root)
    const [nodeB, activateB] = createActivableNode(root)
    const combined = combineStates({ nodeA, nodeB })
    root.run()

    expect(() => combined.getValue({ root: "" })).toThrowError(
      "Inactive Context",
    )
    activateA(true)
    expect(() => combined.getValue({ root: "" })).toThrowError(
      "Inactive Context",
    )
    activateA(false)
    activateB(true)
    expect(() => combined.getValue({ root: "" })).toThrowError(
      "Inactive Context",
    )
    activateA(true)

    expect(combined.getValue({ root: "" })).toEqual({
      nodeA: true,
      nodeB: true,
    })
  })

  it("updates when one of the sources updates", () => {
    const root = createRoot()
    const source$ = new Subject<string>()
    const nodeA = substate(root, () => source$)
    const nodeB = substate(root, () => of("b"))

    const combined = combineStates({ nodeA, nodeB })
    root.run()

    source$.next("a")
    expect(combined.getValue({ root: "" })).toEqual({
      nodeA: "a",
      nodeB: "b",
    })

    source$.next("2")
    expect(combined.getValue({ root: "" })).toEqual({
      nodeA: "2",
      nodeB: "b",
    })
  })

  it("doesn't emit a value until all branches have one", async () => {
    function createSettableNode<K extends Record<string, any>>(
      root: StateNode<never, K>,
    ) {
      const source = new Subject()
      const node = substate(root, () => source)
      return [node, (value: any) => source.next(value)] as const
    }

    const root = createRoot()
    const [nodeA, setA] = createSettableNode(root)
    const [nodeB, setB] = createSettableNode(root)
    const combined = combineStates({ nodeA, nodeB })
    root.run()

    const promise = combined.getValue({ root: "" })
    expect(promise).toBeInstanceOf(Promise)

    const next = vi.fn()
    const complete = vi.fn()
    combined.getState$({ root: "" }).subscribe({ next, complete })
    expect(next).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()

    setA("a")
    expect(next).not.toHaveBeenCalled()

    setB("b")
    expect(next).toHaveBeenCalledWith({ nodeA: "a", nodeB: "b" })
    expect(complete).not.toHaveBeenCalled()

    await expect(promise).resolves.toEqual({ nodeA: "a", nodeB: "b" })

    next.mockReset()
    setA("a2")
    expect(next).toHaveBeenCalledWith({ nodeA: "a2", nodeB: "b" })
    expect(complete).not.toHaveBeenCalled()

    expect(combined.getValue({ root: "" })).toEqual({ nodeA: "a2", nodeB: "b" })
  })

  it("combines states with keys of different lengths", () => {
    const root = createRoot()
    /** I want 3 nodes with key length 1,2,3 and pass it down in the order 1,3,2
     * And to make it more realistic, combine nodes that don't have a context relationship
     *       sA1
     * r-iA1<    sB2
     *       iB2<
     *           iC3
     * -> Combine [sA1,iC3,sB2]
     */
    const iA1 = instanceNode(root, "a")
    const iB2 = instanceNode(iA1, "b")
    const iC3 = instanceNode(iB2, "c")

    const sA1 = substate(iA1, (_ctx, _obs, key) => of("sA" + key.a))
    const sB2 = substate(iB2, (_ctx, _obs, key) => of("sB" + key.b))

    const combined = combineStates({ a: sA1, c: iC3, b: sB2 })
    root.run()

    iA1.addInstance({
      a: 1,
    })
    iB2.addInstance({
      a: 1,
      b: 1,
    })
    iC3.addInstance({
      a: 1,
      b: 1,
      c: 1,
    })

    // Adding this one but it should not exist on the combined state
    iB2.addInstance({
      a: 1,
      b: 2,
    })

    iA1.addInstance({
      a: 2,
    })
    iB2.addInstance({
      a: 2,
      b: 1,
    })
    iC3.addInstance({
      a: 2,
      b: 1,
      c: 1,
    })
    iC3.addInstance({
      a: 2,
      b: 1,
      c: 3,
    })

    expect(combined.getValue({ a: 1, b: 1, c: 1 })).toEqual({
      a: "sA1",
      b: "sB1",
      c: 1,
    })
    expect(combined.getValue({ a: 2, b: 1, c: 1 })).toEqual({
      a: "sA2",
      b: "sB1",
      c: 1,
    })
    expect(combined.getValue({ a: 2, b: 1, c: 3 })).toEqual({
      a: "sA2",
      b: "sB1",
      c: 3,
    })
    expect(() => combined.getValue({ a: 1, b: 2, c: 1 })).toThrow()
    expect(() => combined.getValue({ a: 2, b: 2, c: 1 })).toThrow()
    expect(() => combined.getValue({ a: 2, b: 2, c: 3 })).toThrow()
  })

  it("removes instances when they are removed", () => {
    const root = createRoot()
    const iA1 = instanceNode(root, "a")
    const iB2 = instanceNode(iA1, "b")

    const combined = combineStates({ a: iA1, b: iB2 })
    root.run()

    iA1.addInstance({
      a: 1,
    })
    iB2.addInstance({
      a: 1,
      b: 1,
    })
    iB2.addInstance({
      a: 1,
      b: 2,
    })

    iA1.addInstance({
      a: 2,
    })
    iB2.addInstance({
      a: 2,
      b: 1,
    })
    iB2.addInstance({
      a: 2,
      b: 2,
    })

    expect(combined.getValue({ a: 1, b: 1 })).toEqual({
      a: 1,
      b: 1,
    })
    expect(combined.getValue({ a: 1, b: 2 })).toEqual({
      a: 1,
      b: 2,
    })

    iA1.removeInstance({
      a: 1,
    })

    expect(() => combined.getValue({ a: 1, b: 1 })).toThrow()
    expect(() => combined.getValue({ a: 1, b: 2 })).toThrow()
    expect(combined.getValue({ a: 2, b: 1 })).toEqual({
      a: 2,
      b: 1,
    })
    expect(combined.getValue({ a: 2, b: 2 })).toEqual({
      a: 2,
      b: 2,
    })
  })

  it("combines states when it's declared after having instances already in running", () => {
    const root = createRoot()
    const iA1 = instanceNode(root, "a")
    const iB2 = instanceNode(iA1, "b")
    root.run()

    iA1.addInstance({
      a: 1,
    })
    iB2.addInstance({
      a: 1,
      b: 1,
    })
    const combined = combineStates({ a: iA1, b: iB2 })

    expect(combined.getValue({ a: 1, b: 1 })).toEqual({
      a: 1,
      b: 1,
    })
  })
})

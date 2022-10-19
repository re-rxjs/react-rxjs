import { createRoot } from "./create-root"
import { BehaviorSubject, of, Subject } from "rxjs"
import { substate } from "./substate"
import { combineStates } from "./combineStates"
import { StateNode } from "./types"
import { routeState } from "./route-state"

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
    function createActivableNode(root: StateNode<any, any>) {
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

  it("doesn't emit a value until all branches have one", async () => {
    function createSettableNode(root: StateNode<any, any>) {
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

    const next = jest.fn()
    const complete = jest.fn()
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
})

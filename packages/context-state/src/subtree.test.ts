import { Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { createRoot } from "./create-root"
import { substate } from "./substate"
import { subtree } from "./subtree"

describe("subtree", () => {
  it("creates instances of another root", () => {
    const mainRoot = createRoot()
    const subnode$ = new Subject<string>()
    const subnode = substate(mainRoot, () => subnode$)

    const otherRoot = createRoot().withTypes<{ value: string }>()

    subtree(subnode, (ctx) => otherRoot.run(null, { value: ctx(subnode) }))

    mainRoot.run()

    expect(otherRoot.getValue).toThrow()
    subnode$.next("a")
    expect(otherRoot.getValue()).toEqual({ value: "a" })
    subnode$.next("b")
    expect(otherRoot.getValue()).toEqual({ value: "b" })
  })

  it("the subtree can be referenced simultaneously", () => {
    const mainRoot = createRoot()
    const subnode$ = new Subject<string>()
    const subnode = substate(mainRoot, () => subnode$)

    const otherRootCopy = substate(subnode, (_, getObs$) => getObs$(otherRoot))

    const otherRoot = createRoot().withTypes<{ value: string }>()
    subtree(subnode, (ctx) => otherRoot.run(null, { value: ctx(subnode) }))

    mainRoot.run()

    subnode$.next("a")
    expect(otherRootCopy.getValue()).toEqual({ value: "a" })
  })
})

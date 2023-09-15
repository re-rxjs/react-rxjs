import { substate } from "./substate"
import { createRoot } from "./create-root"
import { describe, it, expect } from "vitest"
import { Subject, of } from "rxjs"
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
})

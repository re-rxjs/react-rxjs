import { Subject, filter, map, startWith } from "rxjs"
import { InstanceUpdate, createRoot, subinstance } from "./"

describe("subinstance", () => {
  it("works", () => {
    const root = createRoot()
    const instance$ = new Subject<InstanceUpdate<string>>()
    const updates$ = new Subject<{ key: string; value: string }>()
    const instanceNode = subinstance(
      root,
      "keyName",
      () => instance$,
      (id) =>
        updates$.pipe(
          filter((v) => v.key === id),
          map((v) => v.value),
          startWith(id),
        ),
    )
    root.run()

    instance$.next({
      type: "add",
      key: "a",
    })
    expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")

    instance$.next({
      type: "add",
      key: "b",
    })
    expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")
    expect(instanceNode.getValue({ keyName: "b" })).toEqual("b")

    updates$.next({
      key: "a",
      value: "new A value",
    })
    expect(instanceNode.getValue({ keyName: "a" })).toEqual("new A value")
    expect(instanceNode.getValue({ keyName: "b" })).toEqual("b")

    instance$.next({
      type: "remove",
      key: "a",
    })
    expect(() => instanceNode.getValue({ keyName: "a" })).toThrow()
    expect(instanceNode.getValue({ keyName: "b" })).toEqual("b")

    instance$.next({
      type: "remove",
      key: "b",
    })
    expect(() => instanceNode.getValue({ keyName: "b" })).toThrow()
  })
})

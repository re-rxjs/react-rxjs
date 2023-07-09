import {
  NEVER,
  Subject,
  filter,
  from,
  map,
  mergeAll,
  of,
  startWith,
} from "rxjs"
import { InstanceUpdate, createRoot, subinstance, substate } from "./"

describe("subinstance", () => {
  describe("behaviour", () => {
    it("creates instances with the specified key name", () => {
      const root = createRoot()
      const instance$ = new Subject<InstanceUpdate<string>>()
      const updates$ = new Subject<{ key: string; value: string }>()
      const [instanceNode] = subinstance(
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

    it("throws if the key name is already used by one of the parents", () => {
      const root = createRoot("rootKey")
      const context = substate(root, () => NEVER)

      expect(() =>
        subinstance(
          root,
          "rootKey",
          () => NEVER,
          () => NEVER,
        ),
      ).toThrow()
      expect(() =>
        subinstance(
          context,
          "rootKey",
          () => NEVER,
          () => NEVER,
        ),
      ).toThrow()
    })

    it("ignores adding duplicate key values", () => {
      const root = createRoot()
      const instance$ = new Subject<InstanceUpdate<string>>()
      const instanceFn = jest.fn((id: string) => of(id))
      const [instanceNode, keys] = subinstance(
        root,
        "keyName",
        () => instance$,
        instanceFn,
      )
      root.run()

      instance$.next({
        type: "add",
        key: "a",
      })
      expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")
      expect(instanceFn).toHaveBeenCalledTimes(1)

      const keysObserver = jest.fn()
      keys.getState$().subscribe(keysObserver)
      expect(keysObserver).toHaveBeenCalledTimes(1)

      instance$.next({
        type: "add",
        key: "a",
      })
      expect(instanceFn).toHaveBeenCalledTimes(1)
      expect(keysObserver).toHaveBeenCalledTimes(1)

      instance$.next({
        type: "remove",
        key: "a",
      })
      expect(() => instanceNode.getValue({ keyName: "a" })).toThrow()
      expect(keysObserver).toHaveBeenCalledTimes(2)
    })

    it("ignores removing key values that don't exist", () => {
      const root = createRoot()
      const instance$ = new Subject<InstanceUpdate<string>>()
      const [instanceNode] = subinstance(
        root,
        "keyName",
        () => instance$,
        (id) => of(id),
      )
      root.run()

      instance$.next({
        type: "add",
        key: "a",
      })
      expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")

      instance$.next({
        type: "remove",
        key: "a",
      })
      expect(() => instanceNode.getValue({ keyName: "a" })).toThrow()

      instance$.next({
        type: "remove",
        key: "a",
      })
      expect(() => instanceNode.getValue({ keyName: "a" })).toThrow()
    })

    it("cleans up all instances when the parent dies", () => {
      const root = createRoot()
      const [instances, keys] = subinstance(
        root,
        "keyName",
        () =>
          from(["a", "b"]).pipe(
            map((key) => ({
              type: "add",
              key,
            })),
          ),
        (id) => of(id),
      )
      const stop = root.run()

      expect(instances.getValue({ keyName: "a" })).toEqual("a")
      expect(instances.getValue({ keyName: "b" })).toEqual("b")
      expect([...(keys.getValue() as Set<string>)]).toEqual(["a", "b"])

      stop()
      expect(() => instances.getValue({ keyName: "a" })).toThrow()
      expect(() => instances.getValue({ keyName: "b" })).toThrow()
      expect(() => [...(keys.getValue() as Set<string>)]).toThrow()
    })
  })

  describe("key selector", () => {
    it("can access values from its context", () => {
      const root = createRoot()
      const keys = substate(root, () => of(["a", "b"]))
      const [_, activeKeys] = subinstance(
        keys,
        "keyName",
        (ctx) =>
          from(ctx(keys)).pipe(
            map((key) => ({
              type: "add",
              key,
            })),
          ),
        (id) => of(id),
      )
      root.run()

      expect([...(activeKeys.getValue() as Set<string>)]).toEqual(["a", "b"])
    })

    it("can reference siblings", () => {
      const root = createRoot()
      // TODO can't do this if root is already running
      // Maybe on that case, catch exception and retry activating on microtask?
      const [_, activeKeys] = subinstance(
        root,
        "keyName",
        (_, getObs$) =>
          getObs$(keys).pipe(
            mergeAll(),
            map((key) => ({
              type: "add",
              key,
            })),
          ),
        (id) => of(id),
      )
      const keys = substate(root, () => of(["a", "b"]))
      root.run()

      expect([...(activeKeys.getValue() as Set<string>)]).toEqual(["a", "b"])
    })
  })

  describe("value selector", () => {
    it("can access values from its context", () => {
      const root = createRoot()
      const values = substate(root, () => of({ a: 1, b: 2 }))
      const [instances] = subinstance(
        values,
        "keyName",
        () =>
          from(["a", "b"] as const).pipe(
            map((key) => ({
              type: "add",
              key,
            })),
          ),
        (id, ctx) => of(ctx(values)[id]),
      )
      root.run()

      expect(instances.getValue({ keyName: "a" })).toEqual(1)
      expect(instances.getValue({ keyName: "b" })).toEqual(2)
    })

    it("can reference siblings", () => {
      const root = createRoot()
      const [instances] = subinstance(
        root,
        "keyName",
        () =>
          from(["a", "b"] as const).pipe(
            map((key) => ({
              type: "add",
              key,
            })),
          ),
        (id, _, getObs$) => getObs$(values).pipe(map((values) => values[id])),
      )
      const values = substate(root, () => of({ a: 1, b: 2 }))
      root.run()

      expect(instances.getValue({ keyName: "a" })).toEqual(1)
      expect(instances.getValue({ keyName: "b" })).toEqual(2)
    })
  })
})

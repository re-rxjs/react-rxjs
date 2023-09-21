import {
  EMPTY,
  NEVER,
  Subject,
  filter,
  map,
  of,
  startWith,
  switchMap,
} from "rxjs"
import { describe, expect, it, vi } from "vitest"
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
        add: ["a"],
      })
      expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")

      instance$.next({
        add: ["b"],
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
        remove: ["a"],
      })
      expect(() => instanceNode.getValue({ keyName: "a" })).toThrow()
      expect(instanceNode.getValue({ keyName: "b" })).toEqual("b")

      instance$.next({
        remove: ["b"],
      })
      expect(() => instanceNode.getValue({ keyName: "b" })).toThrow()
    })

    it("throws if the key name is already used by one of the parents", () => {
      const root = createRoot("rootKey")

      // Try 1-levels deep
      expect(() =>
        subinstance(
          root,
          "rootKey",
          () => NEVER,
          () => NEVER,
        ),
      ).toThrow()

      // Try 2-levels deep
      const context = substate(root, () => NEVER)
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
      const instanceFn = vi.fn((id: string) => of(id))
      const [instanceNode, keys] = subinstance(
        root,
        "keyName",
        () => instance$,
        instanceFn,
      )
      root.run()

      instance$.next({
        add: ["a"],
      })
      expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")
      expect(instanceFn).toHaveBeenCalledTimes(1)

      const keysObserver = vi.fn()
      keys.getState$().subscribe(keysObserver)
      expect(keysObserver).toHaveBeenCalledTimes(1)

      instance$.next({
        add: ["a"],
      })
      expect(instanceFn).toHaveBeenCalledTimes(1)
      expect(keysObserver).toHaveBeenCalledTimes(1)

      instance$.next({
        remove: ["a"],
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
        add: ["a"],
      })
      expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")

      instance$.next({
        remove: ["a"],
      })
      expect(() => instanceNode.getValue({ keyName: "a" })).toThrow()

      instance$.next({
        remove: ["a"],
      })
      expect(() => instanceNode.getValue({ keyName: "a" })).toThrow()
    })

    it("cleans up all instances when the parent dies", () => {
      const root = createRoot()
      const [instances, keys] = subinstance(
        root,
        "keyName",
        () =>
          of({
            add: ["a", "b"],
          }),
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

    it("can access instances as soon as they are announced", () => {
      const root = createRoot()
      const instance$ = new Subject<InstanceUpdate<string>>()
      const [instanceNode, keys] = subinstance(
        root,
        "keyName",
        () => instance$,
        (id) => of(id),
      )
      root.run()

      let error = null
      let lastActive = null
      keys
        .getState$()
        .pipe(
          switchMap((v) =>
            v.size
              ? instanceNode.getState$({
                  keyName: Array.from(v.values()).at(-1)!,
                })
              : EMPTY,
          ),
        )
        .subscribe({
          next: (v) => (lastActive = v),
          error: (e) => (error = e),
        })

      instance$.next({
        add: ["a"],
      })
      expect(lastActive).toEqual("a")
      instance$.next({
        add: ["b"],
      })
      expect(lastActive).toEqual("b")
      expect(error).toBe(null)
    })

    it("continues working after the parent changes value", () => {
      const root = createRoot()
      const subnode$ = new Subject<string>()
      const subnode = substate(root, () => subnode$.pipe(startWith("a")))
      const [instanceNode, keys] = subinstance(
        subnode,
        "keyName",
        (ctx) =>
          ctx(subnode) === "a"
            ? EMPTY
            : of({
                add: ["a", "b"],
              }),
        (id) => of(id),
      )
      root.run()

      expect(Array.from(keys.getValue() as Set<string>)).toEqual([])
      subnode$.next("b")
      expect(Array.from(keys.getValue() as Set<string>)).toEqual(["a", "b"])

      expect(instanceNode.getValue({ keyName: "a" })).toEqual("a")
      expect(instanceNode.getValue({ keyName: "b" })).toEqual("b")
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
          of({
            add: ctx(keys),
          }),
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
            map((keys) => ({
              add: keys,
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
          of({
            add: ["a", "b"] as const,
          }),
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
          of({
            add: ["a", "b"] as const,
          }),
        (id, _, getObs$) => getObs$(values).pipe(map((values) => values[id])),
      )
      const values = substate(root, () => of({ a: 1, b: 2 }))
      root.run()

      expect(instances.getValue({ keyName: "a" })).toEqual(1)
      expect(instances.getValue({ keyName: "b" })).toEqual(2)
    })
  })
})

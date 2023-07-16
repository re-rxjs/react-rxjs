import { Observable, of, Subject } from "rxjs"
import { describe, expect, it, vi } from "vitest"
import { createRoot } from "./create-root"
import { routeState } from "./route-state"
import { substate } from "./substate"

describe("routeState", () => {
  describe("constructor", () => {
    it("requires a node with a value", () => {
      const root = createRoot()
      const [key] = routeState(root, { a: null }, () => "a")
      root.run()

      expect(() => key.getValue()).toThrowError("RootNode doesn't have value")
    })

    it("passes the value of the node as a parameter for the selector function", () => {
      const root = createRoot()
      const parentSource = new Subject<"a" | "b">()
      const parent = substate(root, () => parentSource)
      const [key] = routeState(parent, { a: null, b: null }, (v) => v)
      root.run()

      const promise = key.getValue()
      expect(promise).toBeInstanceOf(Promise)

      parentSource.next("a")
      expect(key.getValue()).toEqual("a")

      parentSource.next("b")
      expect(key.getValue()).toEqual("b")
    })

    it("errors if the selector returns a key that doesn't exist", () => {
      const root = createRoot()
      const parent = substate(root, () => of("c"))
      const [key] = routeState(
        parent,
        { a: null, b: null },
        (v) => v as "a" | "b",
      )
      root.run()

      expect(() => key.getValue()).toThrow(
        'Invalid Route. Received "c" while valid keys are: "a, b"',
      )
    })

    it("errors if the selector throws an error", () => {
      const root = createRoot()
      const parent = substate(root, () => of("c"))
      const [key] = routeState(parent, { a: null, b: null }, () => {
        throw new Error("boom")
      })
      root.run()

      expect(() => key.getValue()).toThrowError("boom")
    })
  })

  describe("activeKey", () => {
    it("returns a node that will have the activeKey", () => {
      const root = createRoot()
      const parentSource = new Subject<"a" | "b">()
      const parent = substate(root, () => parentSource)
      const [key] = routeState(parent, { a: null, b: null }, (v) => v)
      root.run()

      const next = vi.fn()
      key.getState$().subscribe({
        next,
      })

      parentSource.next("a")
      expect(key.getValue()).toEqual("a")

      parentSource.next("b")
      expect(key.getValue()).toEqual("b")

      expect(next).toHaveBeenCalledTimes(2)
      expect(next.mock.calls[0][0]).toEqual("a")
      expect(next.mock.calls[1][0]).toEqual("b")
    })

    it("doesn't re-emit if the selector returns the same key after the parent changes", () => {
      const root = createRoot()
      const parentSource = new Subject<number>()
      const parent = substate(root, () => parentSource)
      const [key] = routeState(parent, { a: null, b: null }, () => "a")
      root.run()

      const next = vi.fn()
      key.getState$().subscribe({ next })

      parentSource.next(1)
      parentSource.next(2)

      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith("a")
    })
  })

  describe("nodes", () => {
    it("creates as many nodes as routes, but activates only the one selected from selector", () => {
      const root = createRoot()
      const parentSource = new Subject<"a" | "b">()
      const parent = substate(root, () => parentSource)
      // Now I'd like to have routes first, then the key on the second place :'D
      const [, routes] = routeState(
        parent,
        {
          a: null,
          b: null,
        },
        (v) => v,
      )
      root.run()

      expect(() => routes.a.getValue()).toThrowError("Inactive Context")
      expect(() => routes.b.getValue()).toThrowError("Inactive Context")

      parentSource.next("a")

      expect(routes.a.getValue()).toEqual("a")
      expect(() => routes.b.getValue()).toThrowError("Inactive Context")
    })

    it("activates the route even if it's declared after the parent was running", () => {
      const root = createRoot()
      const parentSource = new Subject<"a" | "b">()
      const parent = substate(root, () => parentSource)
      root.run()
      parentSource.next("a")

      const [, routes] = routeState(
        parent,
        {
          a: null,
          b: null,
        },
        (v) => v,
      )

      expect(routes.a.getValue()).toEqual("a")
    })

    it("deactivates the previous route before activating the new one", () => {
      const root = createRoot()
      const parentSource = new Subject<"a" | "b">()
      const parent = substate(root, () => parentSource)
      const [, { a, b }] = routeState(
        parent,
        {
          a: null,
          b: null,
        },
        (v) => v,
      )

      const actions: string[] = []
      substate(
        a,
        () =>
          new Observable(() => {
            actions.push("subscribe a")
            return () => {
              actions.push("unsubscribe a")
            }
          }),
      )
      substate(
        b,
        () =>
          new Observable(() => {
            actions.push("subscribe b")
            return () => {
              actions.push("unsubscribe b")
            }
          }),
      )

      root.run()

      parentSource.next("a")
      parentSource.next("b")

      expect(actions).toEqual(["subscribe a", "unsubscribe a", "subscribe b"])
    })

    it("uses the mapFn for each of the routes", () => {
      const root = createRoot()
      const parentSource = new Subject<"a" | "b">()
      const parent = substate(root, () => parentSource)
      const [, { a }] = routeState(
        parent,
        {
          a: (v) => "a mapped " + v,
          b: null,
        },
        (v) => v,
      )

      root.run()

      parentSource.next("a")

      expect(a.getValue()).toEqual("a mapped a")
    })

    it("deactivates the nodes when the parent is deactivated", () => {
      const root = createRoot()
      const parentSource = new Subject<"a" | "b">()
      const parent = substate(root, () => parentSource)
      // Now I'd like to have routes first, then the key on the second place :'D
      const [, routes] = routeState(
        parent,
        {
          a: null,
          b: null,
        },
        (v) => v,
      )
      const stahp = root.run()

      parentSource.next("a")
      expect(routes.a.getValue()).toEqual("a")

      stahp()

      expect(() => routes.a.getValue()).toThrowError("Inactive Context")
    })
  })
})

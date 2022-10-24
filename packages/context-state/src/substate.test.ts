import { routeState } from "./route-state"
import { EMPTY, map, NEVER, Observable, of, Subject, throwError } from "rxjs"
import { createRoot } from "./create-root"
import { substate } from "./substate"

describe("subState", () => {
  describe("constructor", () => {
    it("subscribes to the inner observable when the parent has a value", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)

      let ranFunction = false
      substate(contextNode, () => {
        ranFunction = true
        return EMPTY
      })

      expect(ranFunction).toBe(false)

      root.run()
      expect(ranFunction).toBe(false)

      contextSource$.next(1)
      expect(ranFunction).toBe(true)
    })

    it("unsubscribes from the previous observable before subscribing to the new one when the context changes", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)

      let subscribed = false,
        unsubscribed = false
      substate(contextNode, () => {
        return new Observable(() => {
          subscribed = true

          return () => {
            // the test will reset `subscribed` to false when this function should be run.
            expect(subscribed).toBe(false)
            unsubscribed = true
          }
        })
      })

      root.run()
      contextSource$.next(1)
      expect(subscribed).toBe(true)
      expect(unsubscribed).toBe(false)

      subscribed = false
      contextSource$.next(2)
      expect(subscribed).toBe(true)
      expect(unsubscribed).toBe(true)
    })

    it("can access any observable from the context with the ctx function", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)

      let lastContextValue: number | null = null
      substate(contextNode, (ctx) => {
        expect(ctx(contextNode)).toBe(lastContextValue)
        return EMPTY
      })

      root.run()
      expect.assertions(3)
      contextSource$.next((lastContextValue = 1))
      contextSource$.next((lastContextValue = 2))
      contextSource$.next((lastContextValue = 3))
    })

    it("throws an error when accessing a context that's invalid", () => {
      const root = createRoot()
      const [, { branchB }] = routeState(
        substate(root, () => of("")),
        {
          branchA: null,
          branchB: () => "b",
        },
        () => "branchA",
      )

      substate(root, (ctx) => of(ctx(branchB)))
      expect(() => root.run()).not.toThrow()
    })

    it("becomes unactive after throws an error for an invalid accessed context", () => {
      const root = createRoot()
      const contextSource = new Subject<number>()
      const contextNode = substate(root, () => contextSource)
      const [, { branchB }] = routeState(
        contextNode,
        {
          branchA: null,
          branchB: () => "b",
        },
        () => "branchA",
      )

      const subNode = substate(contextNode, (ctx) => of(ctx(branchB)))

      root.run()

      contextSource.next(1)
      expect(() => contextNode.getValue({ root: "" })).not.toThrow()
      expect(() => subNode.getValue({ root: "" })).toThrowError(
        "Inactive Context",
      )
    })
  })

  describe("getValue", () => {
    it("throws when the node is not active", () => {
      const root = createRoot()
      const subNode = substate(root, () => of(1))

      expect(() => subNode.getValue({ root: "" })).toThrowError(
        "Inactive Context",
      )
    })

    it("after an error it throws the error", () => {
      const root = createRoot()
      const error = new Error("boom!")
      const subNode = substate(root, () => throwError(() => error))
      root.run()

      expect(() => {
        console.log(subNode.getValue({ root: "" }))
      }).toThrowError("boom!")
    })

    it("throws the parent error", () => {
      const root = createRoot()
      const error = new Error("boom!")
      const subNode = substate(root, () => throwError(() => error))
      const subSubNode = substate(subNode, () => of(null))
      root.run()

      expect(() => {
        console.log(subSubNode.getValue({ root: "" }))
      }).toThrowError("boom!")
    })

    it("returns the latest value if the observable has already emitted", () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      root.run()

      source$.next(1)
      source$.next(2)
      source$.next(3)

      expect(subNode.getValue({ root: "" })).toBe(3)
    })

    it("returns a promise that resolves when the first value is emitted", async () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      source$.next(1)
      root.run()

      const promise = subNode.getValue({ root: "" })

      source$.next(2)
      source$.next(3)

      await expect(promise).resolves.toBe(2)
    })

    it("rejects the promise if the node becomes inactive", async () => {
      const root = createRoot()
      const subNode = substate(root, () => NEVER)
      const stop = root.run()

      const promise = subNode.getValue({ root: "" })

      stop()

      await expect(promise).rejects.toBeTruthy()
    })

    it("rejects the promise when the observable emits an error", async () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      root.run()

      const promise = subNode.getValue({ root: "" })

      const error = new Error()
      source$.error(error)

      await expect(promise).rejects.toBe(error)
    })

    it("ignores the observable until its context has a value", async () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const source$ = new Subject<number>()
      const subNode = substate(contextNode, () => source$)
      root.run()

      source$.next(1)

      const promise = subNode.getValue({ root: "" })
      expect(promise).toBeInstanceOf(Promise)

      source$.next(2)
      source$.next(3)

      contextSource$.next(1)

      source$.next(4)

      await expect(promise).resolves.toBe(4)
    })

    it("discards the old value after a context changes, returning a new promise", async () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const source$ = new Subject<number>()
      const subNode = substate(contextNode, () => source$)
      root.run()

      contextSource$.next(1)
      source$.next(2)
      expect(subNode.getValue({ root: "" })).toBe(2)

      contextSource$.next(3)
      const promise = subNode.getValue({ root: "" })

      source$.next(4)
      await expect(promise).resolves.toBe(4)
    })

    it("returns a promise that yields the value after a context has changed", async () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const subNode = substate(contextNode, (ctx) =>
        ctx(contextNode) === 2 ? of("done!") : EMPTY,
      )
      root.run()

      const promise = subNode.getValue({ root: "" })

      contextSource$.next(1)
      contextSource$.next(2)

      await expect(promise).resolves.toBe("done!")
    })

    it("rejects the promise if any of its context emits an error", async () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      root.run()

      const promise = subNode.getValue({ root: "" })

      const error = new Error()
      source$.error(error)

      await expect(promise).rejects.toBe(error)
    })

    it("can reference its siblings", () => {
      const root = createRoot()
      const nodeA = substate(root, (_, getState$) =>
        getState$(nodeB, {}).pipe(map((v) => v + "-a")),
      )
      const nodeB = substate(root, () => of("b"))

      root.run()

      expect(nodeB.getValue()).toBe("b")
      expect(nodeA.getValue()).toBe("b-a")
    })
  })

  describe("state$", () => {
    it("emits the values that the inner observable emits", () => {
      const root = createRoot()
      const source$ = new Subject<number>()
      const subNode = substate(root, () => source$)
      root.run()

      const emissions: number[] = []
      subNode.getState$({ root: "" }).subscribe({
        next: (v) => emissions.push(v),
      })
      expect(emissions).toEqual([])

      source$.next(1)
      expect(emissions).toEqual([1])

      source$.next(2)
      expect(emissions).toEqual([1, 2])
    })

    it("replays the latest value on late subscription", () => {
      const root = createRoot()
      const source$ = new Subject<number>()
      const subNode = substate(root, () => source$)
      root.run()

      source$.next(1)
      expect.assertions(1)
      subNode.getState$({ root: "" }).subscribe({
        next: (v) => {
          expect(v).toBe(1)
        },
      })
    })

    it("emits an error if the node is not active", () => {
      const root = createRoot()
      const source$ = new Subject<number>()
      const subNode = substate(root, () => source$)

      expect.assertions(1)
      subNode.getState$({ root: "" }).subscribe({
        error: (e) => {
          expect(e.message).toEqual("Inactive Context")
        },
      })
    })

    it("emits the error emitted by the inner observable", () => {
      const root = createRoot()
      const source$ = new Subject<number>()
      const subNode = substate(root, () => source$)
      root.run()

      const error = new Error("haha")
      subNode.getState$({ root: "" }).subscribe({
        error: (e) => expect(e).toBe(error),
      })

      expect.assertions(1)
      source$.next(1)
      source$.error(error)
    })

    it("doesn't propagate the complete of the inner observable", () => {
      const root = createRoot()
      const source$ = new Subject<number>()
      const subNode = substate(root, () => source$)
      root.run()

      let completed = false
      subNode.getState$({ root: "" }).subscribe({
        complete: () => (completed = true),
      })

      source$.complete()
      expect(completed).toBe(false)
    })

    it("emits a complete when a context changes", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const source$ = new Subject<number>()
      const subNode = substate(contextNode, () => source$)
      root.run()

      const complete = jest.fn()
      subNode.getState$({ root: "" }).subscribe({ complete })

      contextSource$.next(1)
      expect(complete).not.toHaveBeenCalled()

      contextSource$.next(2)
      expect(complete).not.toHaveBeenCalled()

      source$.next(1)
      expect(complete).not.toHaveBeenCalled()
      contextSource$.next(3)
      expect(complete).toHaveBeenCalled()
    })

    it("doesn't emit the last value on resubscription after a complete", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const source$ = new Subject<number>()
      const subNode = substate(contextNode, () => source$)
      root.run()

      contextSource$.next(1)
      source$.next(1)

      contextSource$.next(2)
      const next = jest.fn()
      subNode.getState$({ root: "" }).subscribe({ next })

      expect(next).not.toHaveBeenCalled()
    })

    it("doesn't emit a complete if a context emits without change", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const source$ = new Subject<number>()
      const subNode = substate(contextNode, () => source$)
      root.run()

      contextSource$.next(1)
      source$.next(1)

      const complete = jest.fn()
      subNode.getState$({ root: "" }).subscribe({ complete })

      contextSource$.next(1)

      expect(complete).not.toHaveBeenCalled()
    })

    it("doesn't emit a complete if after a context change the observable synchronously emits the same value", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const subNode = substate(contextNode, () => of(3))
      root.run()

      contextSource$.next(1)

      const complete = jest.fn()
      subNode.getState$({ root: "" }).subscribe({ complete })

      contextSource$.next(2)

      expect(complete).not.toHaveBeenCalled()
    })

    it("emits the values from the new context change even if the observable was created earlier", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const subNode = substate(contextNode, (ctx) => of(ctx(contextNode)))
      root.run()

      contextSource$.next(1)
      const observable = subNode.getState$({ root: "" })

      contextSource$.next(2)

      expect.assertions(1)
      observable.subscribe((v) => expect(v).toBe(2))
    })
  })
})

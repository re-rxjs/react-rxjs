import { EMPTY, NEVER, Observable, of, Subject, throwError } from "rxjs"
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
  })

  describe("getValue", () => {
    it("throws when the node is not active", () => {
      const root = createRoot()
      const subNode = substate(root, () => of(1))

      expect(() => subNode.getValue()).toThrowError("Inactive Context")
    })

    it("after an error it throws an InactiveContextError", () => {
      const root = createRoot()
      const error = new Error()
      const subNode = substate(root, () => throwError(() => error))
      root.run()

      expect(() => {
        console.log(subNode.getValue())
      }).toThrowError("Inactive Context")
    })

    it("returns the latest value if the observable has already emitted", () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      root.run()

      source$.next(1)
      source$.next(2)
      source$.next(3)

      expect(subNode.getValue()).toBe(3)
    })

    it("returns a promise that resolves when the first value is emitted", async () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      source$.next(1)
      root.run()

      const promise = subNode.getValue()

      source$.next(2)
      source$.next(3)

      await expect(promise).resolves.toBe(2)
    })

    it("rejects the promise if the node becomes inactive", async () => {
      const root = createRoot()
      const subNode = substate(root, () => NEVER)
      const stop = root.run()

      const promise = subNode.getValue()

      stop()

      await expect(promise).rejects.toBeTruthy()
    })

    it("rejects the promise when the observable emits an error", async () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      root.run()

      const promise = subNode.getValue()

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

      const promise = subNode.getValue()
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
      expect(subNode.getValue()).toBe(2)

      contextSource$.next(3)
      const promise = subNode.getValue()

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

      const promise = subNode.getValue()

      contextSource$.next(1)
      contextSource$.next(2)

      await expect(promise).resolves.toBe("done!")
    })

    it("rejects the promise if any of its context emits an error", async () => {
      const source$ = new Subject<number>()
      const root = createRoot()
      const subNode = substate(root, () => source$)
      root.run()

      const promise = subNode.getValue()

      const error = new Error()
      source$.error(error)

      await expect(promise).rejects.toBe(error)
    })
  })

  describe("state$", () => {})
})

import {
  concat,
  EMPTY,
  from,
  map,
  NEVER,
  Observable,
  of,
  startWith,
  Subject,
  throwError,
  withLatestFrom,
} from "rxjs"
import { describe, expect, it, vi } from "vitest"
import { createRoot } from "./create-root"
import { createSignal } from "./create-signal"
import { routeState } from "./route-state"
import { substate } from "./substate"
import { testFinalizationRegistry } from "./test-utils/finalizationRegistry"

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
        console.log(subNode.getValue())
      }).toThrowError("boom!")
    })

    it("throws the parent error", () => {
      const root = createRoot()
      const error = new Error("boom!")
      const subNode = substate(root, () => throwError(() => error))
      const subSubNode = substate(subNode, () => of(null))
      root.run()

      expect(() => {
        console.log(subSubNode.getValue())
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

    it("can reference its siblings after a change", () => {
      const root = createRoot()
      const source$ = new Subject<string>()
      const subNode = substate(root, () => source$)
      const nodeA = substate(subNode, (ctx, getState$) =>
        getState$(nodeB, {}).pipe(map((v) => ctx(subNode) + "-" + v + "-a")),
      )
      const nodeB = substate(subNode, (ctx) => of("b" + ctx(subNode)))

      root.run()

      expect(nodeA.getValue()).toBeInstanceOf(Promise)
      source$.next("1")

      expect(nodeB.getValue()).toBe("b1")
      expect(nodeA.getValue()).toBe("1-b1-a")

      source$.next("2")

      expect(nodeB.getValue()).toBe("b2")
      expect(nodeA.getValue()).toBe("2-b2-a")
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

    it("can be declared on a node already running", () => {
      const root = createRoot()
      const source$ = new Subject<number>()
      root.run()
      const subNode = substate(root, () => source$)

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

      subNode.getState$({ root: "" }).subscribe({
        error: (e) => {
          expect(e.message).toEqual("Inactive Context")
        },
      })
      expect.assertions(1)
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

      const complete = vi.fn()
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
      const next = vi.fn()
      subNode.getState$({ root: "" }).subscribe({ next })

      expect(next).not.toHaveBeenCalled()
    })

    it("emits the next value after a reentrant resubscription on context change", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const source$ = new Subject<number>()
      const subNode = substate(contextNode, () => source$)
      root.run()

      contextSource$.next(1)
      source$.next(1)
      const next = vi.fn()
      subNode.getState$().subscribe({
        complete: () => {
          subNode.getState$().subscribe({ next })
        },
      })

      contextSource$.next(2)
      expect(next).not.toHaveBeenCalled()

      source$.next(1)
      expect(next).toHaveBeenCalledWith(1)
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

      const complete = vi.fn()
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

      const complete = vi.fn()
      subNode.getState$({ root: "" }).subscribe({ complete })

      contextSource$.next(2)

      expect(complete).not.toHaveBeenCalled()
    })

    it("completes when it's further down the chain even if the parent didn't complete", () => {
      const root = createRoot()
      const contextSource$ = new Subject<number>()
      const contextNode = substate(root, () => contextSource$)
      const subNodeA = substate(contextNode, () => of(3))
      const subNodeB = substate(subNodeA, (ctx) => of(ctx(contextNode)))
      root.run()

      contextSource$.next(1)

      expect(subNodeB.getValue()).toEqual(1)

      const complete = vi.fn()
      subNodeB.getState$({ root: "" }).subscribe({ complete })

      contextSource$.next(2)

      expect(complete).toHaveBeenCalled()
      expect(subNodeB.getValue()).toEqual(2)
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

    it("cleans up after self-referencing observables", () => {
      const root = createRoot()
      const signal = createSignal<string, {}>(root)
      const teardown = vi.fn()
      const nodeA = substate(
        root,
        (_, getState$) =>
          new Observable<string>((obs) => {
            const sub = getState$(signal)
              .pipe(
                withLatestFrom(getState$(nodeA).pipe(startWith(""))),
                map(([val, prev]) => prev + val),
              )
              .subscribe(obs)

            return () => {
              sub.unsubscribe()
              teardown()
            }
          }),
      )
      const stop = root.run()

      signal.push("a")
      signal.push("b")
      signal.push("c")
      expect(nodeA.getValue()).toEqual("abc")
      expect(teardown).not.toBeCalled()
      stop()
      expect(teardown).toBeCalled()
    })

    it("doesn't hold references to the observables that were created", async () => {
      const fr = testFinalizationRegistry()
      const root = createRoot()

      const nodeA = substate(root, () =>
        fr.tag("nodeA", concat(from([1, 2, 3]), NEVER)),
      )
      const stop = root.run()

      expect(nodeA.getValue()).toEqual(3)
      stop()

      await fr.assertFinalized("nodeA")
    })

    it("doesn't hold references to dead instances, even on circular references", async () => {
      const fr = testFinalizationRegistry()
      const root = createRoot("gameId")
      const signal = createSignal(root)

      const nodeA = substate(
        root,
        (_, getState$, { gameId }): Observable<string> =>
          fr.tag(
            "nodeA-" + gameId,
            getState$(signal).pipe(
              withLatestFrom(getState$(nodeB).pipe(startWith(""))),
              map(([, prev]) => prev + "/a/"),
            ),
          ),
      )
      const nodeB = substate(
        root,
        (_, getState$, { gameId }): Observable<string> =>
          fr.tag(
            "nodeB-" + gameId,
            getState$(nodeA).pipe(map((v) => v + "$b$")),
          ),
      )

      root.run("b")
      const stopA = root.run("a")

      signal.push({ gameId: "a" }, null)
      signal.push({ gameId: "a" }, null)
      signal.push({ gameId: "a" }, null)
      expect(nodeA.getValue({ gameId: "a" })).toEqual("/a/$b$/a/$b$/a/")
      stopA()

      await fr.assertFinalized("nodeA-a")
      await fr.assertFinalized("nodeB-a")
    })
  })
})

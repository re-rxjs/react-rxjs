import { KeyChanges } from "./partitionByKey"
import { TestScheduler } from "rxjs/testing"
import { toKeySet } from "./toKeySet"
import { asapScheduler, map, observeOn, of, Subject } from "rxjs"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("toKeySet", () => {
  it("transforms key changes to a Set", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const expectedStr = "                     xe--f-g--h#"
      const source$ = cold<KeyChanges<string>>("-a--b-c--d#", {
        a: {
          type: "add",
          keys: ["a", "b"],
        },
        b: {
          type: "remove",
          keys: ["b", "c"],
        },
        c: {
          type: "add",
          keys: ["c"],
        },
        d: {
          type: "remove",
          keys: ["a"],
        },
      })

      const result$ = source$.pipe(
        toKeySet(),
        map((s) => Array.from(s)),
      )

      expectObservable(result$).toBe(expectedStr, {
        x: [],
        e: ["a", "b"],
        f: ["a"],
        g: ["a", "c"],
        h: ["c"],
      })
    })
  })

  it("emits synchronously on the first subscribe if it receives a synchronous change", () => {
    const emissions: string[][] = []
    of<KeyChanges<string>>({
      type: "add",
      keys: ["a", "b"],
    })
      .pipe(toKeySet())
      .subscribe((next) => emissions.push(Array.from(next)))

    expect(emissions.length).toBe(1)
    expect(emissions[0]).toEqual(["a", "b"])
  })

  it("emits synchronously an empty Set if it doesn't receive a synchronous change", () => {
    const emissions: string[][] = []
    of<KeyChanges<string>>({
      type: "add",
      keys: ["a", "b"],
    })
      .pipe(observeOn(asapScheduler), toKeySet())
      .subscribe((next) => emissions.push(Array.from(next)))

    expect(emissions.length).toBe(1)
    expect(emissions[0]).toEqual([])
  })

  it("resets the Set after unsubscribing", () => {
    const input$ = new Subject<KeyChanges<string>>()
    const result$ = input$.pipe(toKeySet())

    let emissions: string[][] = []
    let sub = result$.subscribe((v) => emissions.push(Array.from(v)))
    input$.next({
      type: "add",
      keys: ["a"],
    })
    expect(emissions.length).toBe(2) // [0] is initial empty []
    expect(emissions[1]).toEqual(["a"])
    sub.unsubscribe()

    emissions = []
    sub = result$.subscribe((v) => emissions.push(Array.from(v)))
    input$.next({
      type: "add",
      keys: ["b"],
    })
    expect(emissions.length).toBe(2) // [0] is initial empty []
    expect(emissions[1]).toEqual(["b"])
    sub.unsubscribe()
  })
})

import { concat, defer, from, NEVER, Observable, of, Subject } from "rxjs"
import {
  catchError,
  defaultIfEmpty,
  map,
  scan,
  switchMap,
  take,
} from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { partitionByKey, KeyChanges } from "./"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("partitionByKey", () => {
  describe("behaviour", () => {
    it("groups observables by using the key function", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-12-3456-")
        const expectOdd = "  -1--3-5--"
        const expectEven = " --2--4-6-"

        const [getInstance$] = partitionByKey(source, (v) => Number(v) % 2)

        expectObservable(getInstance$(0)).toBe(expectEven)
        expectObservable(getInstance$(1)).toBe(expectOdd)
      })
    })

    it("unsubscribes from all streams when refcount reaches 0", () => {
      let innerSubs = 0
      const inner = new Observable<number>(() => {
        innerSubs++
        return () => {
          innerSubs--
        }
      })

      const sourceSubject = new Subject<number>()
      let sourceSubs = 0
      const source = new Observable<number>((obs) => {
        sourceSubs++
        sourceSubject.subscribe(obs)
        return () => {
          sourceSubs--
        }
      })

      const [getObs] = partitionByKey(
        source,
        (v) => v,
        () => inner,
      )
      const observable = getObs(1)

      expect(sourceSubs).toBe(0)
      expect(innerSubs).toBe(0)

      const sub1 = observable.subscribe()

      expect(sourceSubs).toBe(1)
      expect(innerSubs).toBe(0)

      sourceSubject.next(1)

      expect(sourceSubs).toBe(1)
      expect(innerSubs).toBe(1)

      const sub2 = observable.subscribe()

      expect(sourceSubs).toBe(1)
      expect(innerSubs).toBe(1)

      sub1.unsubscribe()

      expect(sourceSubs).toBe(1)
      expect(innerSubs).toBe(1)

      sub2.unsubscribe()

      expect(sourceSubs).toBe(0)
      expect(innerSubs).toBe(0)
    })

    it("emits a complete on the inner observable when the source completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-a-|")
        const expectA = "    -a--a-(c|)"
        const expectB = "    --b---(c|)"

        const [getInstance$] = partitionByKey(
          source,
          (v) => v,
          (v$) => concat(v$, ["c"]),
        )

        expectObservable(getInstance$("a")).toBe(expectA)
        expectObservable(getInstance$("b")).toBe(expectB)
      })
    })

    it("emits the error on the inner observable when the source errors", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-a-#")
        const expectA = "    -a--a-(e|)"
        const expectB = "    --b---(e|)"

        const [getInstance$] = partitionByKey(
          source,
          (v) => v,
          (v$) => v$.pipe(catchError(() => of("e"))),
        )

        expectObservable(getInstance$("a")).toBe(expectA)
        expectObservable(getInstance$("b")).toBe(expectB)
      })
    })

    it("handles an empty Observable", () => {
      scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
        const e1 = cold("  |")
        const e1subs = "   (^!)"
        const expectObs = "|"
        const expectKey = "(x|)"

        const [getObs, keys$] = partitionByKey(
          e1,
          (v) => v,
          (v$) => v$,
        )

        expectObservable(getObs("")).toBe(expectObs)
        expectSubscriptions(e1.subscriptions).toBe(e1subs)
        expectObservable(getKeyValues(keys$)).toBe(expectKey, { x: [] })
      })
    })

    it("handles a never Observable", () => {
      scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
        const e1 = cold("  --")
        const e1subs = "   ^-"
        const expectObs = "--"
        const expectKey = "x-"

        const [getObs, keys$] = partitionByKey(
          e1,
          (v) => v,
          (v$) => v$,
        )

        expectObservable(getObs("")).toBe(expectObs)
        expectSubscriptions(e1.subscriptions).toBe(e1subs)
        expectObservable(getKeyValues(keys$)).toBe(expectKey, { x: [] })
      })
    })

    it("handles a just-throw Observable", () => {
      scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
        const e1 = cold("  #")
        const e1subs = "   (^!)"
        const expectObs = "#"
        const expectKey = "(x#)"

        const [getObs, keys$] = partitionByKey(
          e1,
          (v) => v,
          (v$) => v$,
        )

        expectObservable(getObs("")).toBe(expectObs)
        expectSubscriptions(e1.subscriptions).toBe(e1subs)
        expectObservable(getKeyValues(keys$)).toBe(expectKey, { x: [] })
      })
    })

    it("handles synchronous values", () => {
      scheduler().run(({ expectObservable }) => {
        const e1 = from(["1", "2", "3", "4", "5"])
        const expectOdd = " (135|)"
        const expectEven = "(24|)"
        const expectKeys = "(wxyz|)"
        const [getObs, keys$] = partitionByKey(
          e1,
          (v) => Number(v) % 2,
          (v$) => v$,
        )
        expectObservable(getKeyValues(keys$)).toBe(expectKeys, {
          w: [1],
          x: [1, 0],
          y: [0],
          z: [],
        })
        expectObservable(getObs(0)).toBe(expectEven)
        expectObservable(getObs(1)).toBe(expectOdd)
      })
    })
  })

  describe("activeKeys$", () => {
    it("emits a list with all the active keys", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-a-cd---")
        const expectedStr = "efg---hi---"
        const [, result] = partitionByKey(
          source,
          (v) => v,
          () => NEVER,
        )

        expectObservable(getKeyValues(result)).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
          h: ["a", "b", "c"],
          i: ["a", "b", "c", "d"],
        })
      })
    })

    it("removes a key from the list when its inner stream completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab---c--")
        const a = cold("      --1---2-")
        const b = cold("       ---|")
        const c = cold("           1-|")
        const expectedStr = "efg--hi-j"
        const innerStreams: Record<string, Observable<string>> = { a, b, c }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(getKeyValues(result)).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
          h: ["a"],
          i: ["a", "c"],
          j: ["a"],
        })
      })
    })

    it("keeps the existing keys alive when the source completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-|")
        const a = cold("      --1---2-|")
        const b = cold("       ---|")
        const expectedStr = "efg--h---(i|)"
        const innerStreams: Record<string, Observable<string>> = { a, b }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(getKeyValues(result)).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
          h: ["a"],
          i: [],
        })
      })
    })

    it("completes when no key is alive and the source completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab---|")
        const a = cold("      --1|")
        const b = cold("       ---|")
        const expectedStr = "efg-hi|"
        const innerStreams: Record<string, Observable<string>> = { a, b }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(getKeyValues(result)).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
          h: ["b"],
          i: [],
        })
      })
    })

    it("errors when the source emits an error and no group is active", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab--#")
        const a = cold("      --1|")
        const b = cold("       -|")
        const expectedStr = "efghi#"
        const innerStreams: Record<string, Observable<string>> = { a, b }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(getKeyValues(result)).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
          h: ["a"],
          i: [],
        })
      })
    })

    it("doesn't error when the source errors and its inner streams stop the error", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab--#")
        const a = cold("      --1--2--3|")
        const b = cold("       ----|")
        const expectedStr = "efg---h---(i|)"
        const innerStreams: Record<string, Observable<string>> = { a, b }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(getKeyValues(result)).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
          h: ["a"],
          i: [],
        })
      })
    })

    it("errors when one of its inner stream emits an error", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-----")
        const a = cold("      --1-#")
        const b = cold("       ------")
        const expectedStr = "efg--#"
        const innerStreams: Record<string, Observable<string>> = { a, b }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (_, v) => innerStreams[v],
        )

        expectObservable(getKeyValues(result)).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
        })
      })
    })
  })

  describe("getInstance$", () => {
    it("returns the values for the selected key", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab---c--")
        const a = cold("      --1---2-")
        const b = cold("       ---|")
        const c = cold("           1-|")
        const expectA = "    ---1---2--"
        const expectB = "    -----|"
        const expectC = "    ------1-|"

        const innerStreams: Record<string, Observable<string>> = { a, b, c }
        const [getInstance$] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(getInstance$("a")).toBe(expectA)
        expectObservable(getInstance$("b")).toBe(expectB)
        expectObservable(getInstance$("c")).toBe(expectC)
      })
    })

    it("replays the latest value for each key", () => {
      const source$ = new Subject<string>()
      const inner$ = new Subject<number>()
      const [getInstance$] = partitionByKey(
        source$,
        (v) => v,
        () => inner$,
      )

      const next = jest.fn()
      getInstance$("a").subscribe(next)

      source$.next("a")
      expect(next).not.toHaveBeenCalled()

      inner$.next(1)
      expect(next).toHaveBeenCalledTimes(1)
      expect(next).toHaveBeenCalledWith(1)

      const lateNext = jest.fn()
      getInstance$("a").subscribe(lateNext)
      expect(lateNext).toHaveBeenCalledTimes(1)
      expect(lateNext).toHaveBeenCalledWith(1)
    })

    it("lets the projection function handle completions", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-a-|")
        const concatenated = cold("123|")
        const expectA = "    -a--a-123|"
        const expectB = "    --b---123|"

        const [getInstance$] = partitionByKey(
          source,
          (v) => v,
          (v$) => concat(v$, concatenated),
        )

        expectObservable(getInstance$("a")).toBe(expectA)
        expectObservable(getInstance$("b")).toBe(expectB)
      })
    })

    it("lets the projection function catch source errors", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-a-#")
        const expectA = "    -a--a-(e|)"
        const expectB = "    --b---(e|)"

        const [getInstance$] = partitionByKey(
          source,
          (v) => v,
          (v$) => v$.pipe(catchError(() => of("e"))),
        )

        expectObservable(getInstance$("a")).toBe(expectA)
        expectObservable(getInstance$("b")).toBe(expectB)
      })
    })
  })
})

function getKeyValues<T>(observable: Observable<KeyChanges<T>>) {
  return defer(() =>
    observable.pipe(
      scan((acc, change) => {
        for (let key of change.keys) {
          if (change.type === "add") {
            acc.add(key)
          } else {
            acc.delete(key)
          }
        }
        return acc
      }, new Set<T>()),
      map((v) => [...v]),
      defaultIfEmpty([]),
    ),
  )
}

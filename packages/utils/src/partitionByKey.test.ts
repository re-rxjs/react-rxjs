import { concat, EMPTY, from, NEVER, Observable, of, Subject } from "rxjs"
import { catchError, map, switchMap, take } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { combineKeys, KeyChanges, partitionByKey } from "./"

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
        const expectKey = "|"

        const [getObs, keys$] = partitionByKey(
          e1,
          (v) => v,
          (v$) => v$,
        )

        expectObservable(getObs("")).toBe(expectObs)
        expectSubscriptions(e1.subscriptions).toBe(e1subs)
        expectObservable(keys$).toBe(expectKey)
      })
    })

    it("handles a never Observable", () => {
      scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
        const e1 = cold("  --")
        const e1subs = "   ^-"
        const expectObs = "--"
        const expectKey = "--"

        const [getObs, keys$] = partitionByKey(
          e1,
          (v) => v,
          (v$) => v$,
        )

        expectObservable(getObs("")).toBe(expectObs)
        expectSubscriptions(e1.subscriptions).toBe(e1subs)
        expectObservable(keys$).toBe(expectKey)
      })
    })

    it("handles a just-throw Observable", () => {
      scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
        const e1 = cold("  #")
        const e1subs = "   (^!)"
        const expectObs = "#"
        const expectKey = "#"

        const [getObs, keys$] = partitionByKey(
          e1,
          (v) => v,
          (v$) => v$,
        )

        expectObservable(getObs("")).toBe(expectObs)
        expectSubscriptions(e1.subscriptions).toBe(e1subs)
        expectObservable(keys$).toBe(expectKey)
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
        expectObservable(deltasToPOJO(keys$)).toBe(expectKeys, {
          w: {
            type: "add",
            keys: [1],
          },
          x: {
            type: "add",
            keys: [0],
          },
          y: {
            type: "remove",
            keys: [1],
          },
          z: {
            type: "remove",
            keys: [0],
          },
        })
        expectObservable(getObs(0)).toBe(expectEven)
        expectObservable(getObs(1)).toBe(expectOdd)
      })
    })
  })

  describe("activeKeys$", () => {
    it("emits deltas when keys are added", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-a-cd---")
        const expectedStr = "-fg---hi---"
        const [, result] = partitionByKey(
          source,
          (v) => v,
          () => NEVER,
        )

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["b"],
          },
          h: {
            type: "add",
            keys: ["c"],
          },
          i: {
            type: "add",
            keys: ["d"],
          },
        })
      })
    })

    it("removes a key when its inner stream completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab---c--")
        const a = cold("      --1---2-")
        const b = cold("       ---|")
        const c = cold("           1-|")
        const expectedStr = "-fg--hi-j"
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

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["b"],
          },
          h: {
            type: "remove",
            keys: ["b"],
          },
          i: {
            type: "add",
            keys: ["c"],
          },
          j: {
            type: "remove",
            keys: ["c"],
          },
        })
      })
    })

    it("emits the changes on a key even if it's removed synchronously", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ae----s----")
        const expectedStr = "-f(gh)-(ij)-"
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (_, key) => (key === "e" ? EMPTY : key === "s" ? of(1) : NEVER),
        )

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["e"],
          },
          h: {
            type: "remove",
            keys: ["e"],
          },
          i: {
            type: "add",
            keys: ["s"],
          },
          j: {
            type: "remove",
            keys: ["s"],
          },
        })
      })
    })

    it("emits all the existing keys when subscribing late", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-abe-a-cd---")
        const sub1 = "       ^--------"
        const sub2 = "       ----^----"
        const expectedStr = "----f--gh---"
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (_, key) => (key === "e" ? EMPTY : NEVER),
        )

        expectObservable(deltasToPOJO(result), sub1)
        expectObservable(deltasToPOJO(result), sub2).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a", "b"],
          },
          g: {
            type: "add",
            keys: ["c"],
          },
          h: {
            type: "add",
            keys: ["d"],
          },
        })
      })
    })

    it("keeps the existing keys alive when the source completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-|")
        const a = cold("      --1---2-|")
        const b = cold("       ---|")
        const expectedStr = "-fg--h---(i|)"
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

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["b"],
          },
          h: {
            type: "remove",
            keys: ["b"],
          },
          i: {
            type: "remove",
            keys: ["a"],
          },
        })
      })
    })

    it("completes when no key is alive and the source completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab---|")
        const a = cold("      --1|")
        const b = cold("       ---|")
        const expectedStr = "-fg-hi|"
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

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["b"],
          },
          h: {
            type: "remove",
            keys: ["a"],
          },
          i: {
            type: "remove",
            keys: ["b"],
          },
        })
      })
    })

    it("errors when the source emits an error and no group is active", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab--#")
        const a = cold("      --1|")
        const b = cold("       -|")
        const expectedStr = "-fghi#"
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

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["b"],
          },
          h: {
            type: "remove",
            keys: ["b"],
          },
          i: {
            type: "remove",
            keys: ["a"],
          },
        })
      })
    })

    it("doesn't error when the source errors and its inner streams stop the error", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab--#")
        const a = cold("      --1--2--3|")
        const b = cold("       ----|")
        const expectedStr = "-fg---h---(i|)"
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

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["b"],
          },
          h: {
            type: "remove",
            keys: ["b"],
          },
          i: {
            type: "remove",
            keys: ["a"],
          },
        })
      })
    })

    it("errors when one of its inner stream emits an error", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-----")
        const a = cold("      --1-#")
        const b = cold("       ------")
        const expectedStr = "-fg--#"
        const innerStreams: Record<string, Observable<string>> = { a, b }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (_, v) => innerStreams[v],
        )

        expectObservable(deltasToPOJO(result)).toBe(expectedStr, {
          f: {
            type: "add",
            keys: ["a"],
          },
          g: {
            type: "add",
            keys: ["b"],
          },
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

  describe("performance", () => {
    beforeEach(() => {
      ;(global as any).gc()
    })
    it("has an acceptable performance when it synchronously receives a gust of new keys", () => {
      const array = new Array(15_000).fill(0).map((_, i) => i)

      const [, keys$] = partitionByKey(from(array), (v) => v)

      const start = performance.now()
      keys$.subscribe()
      const result = performance.now() - start
      console.log("result 1", result)
      expect(result).toBeLessThan(500)
    })

    it("has an acceptable performance when it synchronously receives a gust of new keys and subscriptions are created on every inner observable", () => {
      const array = new Array(7_500).fill(0).map((_, i) => i)

      const [getInner$, keys$] = partitionByKey(from(array), (v) => v)
      const result$ = combineKeys(keys$, getInner$)

      const start = performance.now()
      result$.subscribe()
      const result = performance.now() - start
      console.log("result 2", result)
      expect(result).toBeLessThan(500)
    })
  })
})

function deltasToPOJO<T>(observable: Observable<KeyChanges<T>>) {
  return observable.pipe(
    map((change) => ({
      type: change.type,
      keys: Array.from(change.keys),
    })),
  )
}

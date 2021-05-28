import { concat, NEVER, Observable, of, Subject } from "rxjs"
import { catchError, switchMap, take } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { partitionByKey } from "./"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("partitionByKey", () => {
  describe("activeKeys$", () => {
    it("emits a list with all the active keys", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab---cd---")
        const expectedStr = "efg---hi---"
        const [, result] = partitionByKey(
          source,
          (v) => v,
          () => NEVER,
        )

        expectObservable(result).toBe(expectedStr, {
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
        const innerStreams: Record<string, Observable<any>> = { a, b, c }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(result).toBe(expectedStr, {
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
        const innerStreams = { a, b }
        const [, result] = partitionByKey(
          source,
          (v) => v,
          (v$) =>
            v$.pipe(
              take(1),
              switchMap((v) => innerStreams[v]),
            ),
        )

        expectObservable(result).toBe(expectedStr, {
          e: [],
          f: ["a"],
          g: ["a", "b"],
          h: ["a"],
          i: [],
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

        const innerStreams: Record<string, Observable<any>> = { a, b, c }
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

    // Do we want this behaviour?
    it("emits an error when the source errors", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const source = cold("-ab-a-#")
        const expectA = "    -a--a-#"
        const expectB = "    --b---#"

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

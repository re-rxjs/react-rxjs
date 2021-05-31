import { NEVER, Observable, Subject } from "rxjs"
import { switchMap, take } from "rxjs/operators"
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
  })
})

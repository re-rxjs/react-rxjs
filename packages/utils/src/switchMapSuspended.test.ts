import { TestScheduler } from "rxjs/testing"
import { SUSPENSE } from "@react-rxjs/core"
import { switchMapSuspended } from "./"
import { of } from "rxjs"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("operators/switchMapSuspended", () => {
  it("acts like a switchMap, but emitting a SUSPENSE when activating the inner stream", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const source = cold("-x---")
      const inner = cold("  ----a")
      const expected = "   -s---a"

      const result$ = source.pipe(switchMapSuspended(() => inner))

      expectObservable(result$).toBe(expected, {
        s: SUSPENSE,
        a: "a",
      })
    })
  })

  it("emits another SUSPENSE when another inner stream activates", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const source = cold("-x--x")
      const inner = cold("     ----a")
      const expected = "   -s--s---a"

      const result$ = source.pipe(switchMapSuspended(() => inner))

      expectObservable(result$).toBe(expected, {
        s: SUSPENSE,
        a: "a",
      })
    })
  })

  it("does not emits another SUSPENSE when the next inner stream is sync", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const source = cold("-x--x")
      const inner = of("a")
      const expected = "   -a--a"

      const result$ = source.pipe(switchMapSuspended(() => inner))

      expectObservable(result$).toBe(expected, {
        s: SUSPENSE,
        a: "a",
      })
    })
  })
})

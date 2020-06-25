import { TestScheduler } from "rxjs/testing"
import { switchMapSuspended } from "../../src/operators/switchMapSuspended"
import { SUSPENSE } from "../../src/SUSPENSE"

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
})

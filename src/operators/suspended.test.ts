import { TestScheduler } from "rxjs/testing"
import { suspended, SUSPENSE } from "../"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("operators/suspended", () => {
  it("prepends the stream with SUSPENSE", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const source = cold("----a")
      const expected = "   s---a"

      const result$ = source.pipe(suspended())

      expectObservable(result$).toBe(expected, {
        s: SUSPENSE,
        a: "a",
      })
    })
  })
})

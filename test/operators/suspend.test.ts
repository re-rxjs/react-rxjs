import { TestScheduler } from "rxjs/testing"
import { suspend, SUSPENSE } from "../../src"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("operators/suspend", () => {
  it("prepends the source stream with SUSPENSE", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const source = cold("----a")
      const expected = "   s---a"

      const suspended = suspend(source)

      expectObservable(suspended).toBe(expected, {
        s: SUSPENSE,
        a: "a",
      })
    })
  })
})

import { TestScheduler } from "rxjs/testing"
import { SUSPENSE } from "@react-rxjs/core"
import { of } from "rxjs"
import { suspend } from "./"

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

  it("does not prepend the source stream with SUSPENSE when the source is sync", () => {
    scheduler().run(({ expectObservable }) => {
      const source = of("a")
      const expected = "(a|)"

      const suspended = suspend(source)

      expectObservable(suspended).toBe(expected, {
        s: SUSPENSE,
        a: "a",
      })
    })
  })
})

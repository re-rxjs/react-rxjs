import { map } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { mergeWithKey } from "./"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("mergeWithKey", () => {
  it("emits the key of the stream that emitted the value", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const sourceA = cold("a---b---|")
      const sourceB = cold("-1--2----3|")
      const expected = "    mn--(op)-q|"

      const result = mergeWithKey({
        strings: sourceA,
        numbers: sourceB,
      }).pipe(map(({ type, payload }) => `${type}:${payload}`))

      expectObservable(result).toBe(expected, {
        m: "strings:a",
        n: "numbers:1",
        o: "strings:b",
        p: "numbers:2",
        q: "numbers:3",
      })
    })
  })
})

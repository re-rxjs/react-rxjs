import { map, shareReplay, skip, startWith } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { collect } from "./"
import { GroupedObservable } from "rxjs"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("collect", () => {
  it("emits a map with the latest grouped stream", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const toGrouped = (source: string, key: string) => {
        const result = cold(source).pipe(shareReplay(1)) as GroupedObservable<
          string,
          string
        >
        result.key = key
        return result
      }

      const a = toGrouped("-------|     ", "a")
      const b = toGrouped(" ---|        ", "b")
      const c = toGrouped("     ------- ", "c")
      const d = toGrouped("      -----| ", "d")

      const sourceStr = "  ab---cd--|   "
      const expectedStr = "ef--ghij-(k|)"

      const source = cold(sourceStr, { a, b, c, d }).pipe(skip(1), startWith(a))
      const result = source.pipe(
        collect(),
        map((x) => Object.fromEntries(x.entries())),
      )

      expectObservable(result).toBe(expectedStr, {
        e: { a },
        f: { a, b },
        g: { a },
        h: { a, c },
        i: { a, c, d },
        j: { c, d },
        k: {},
      })
    })
  })
})

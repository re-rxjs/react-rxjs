import { TestScheduler } from "rxjs/testing"
import { shareReplay, skip, startWith } from "rxjs/operators"
import { GroupedObservable } from "rxjs"
import { collect } from "./collect"
import { getGroupedObservable } from "./"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("getGroupedObservable", () => {
  it("returns the inner observable for the giving key", () => {
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
      const b = toGrouped("---|        ", "b")
      const c = toGrouped("------| ", "c")
      const d = toGrouped("------| ", "d")

      const sourceStr = "  (abc)d---------------------|   "
      const source = cold(sourceStr, { a, b, c, d }).pipe(skip(1), startWith(a))
      const result = collect<string, string>()(source)
      result.subscribe()
      expectObservable(getGroupedObservable(result, "a")).toBe("-------|")
      expectObservable(getGroupedObservable(result, "b")).toBe("---|")
      expectObservable(getGroupedObservable(result, "c")).toBe("------|")
      expectObservable(getGroupedObservable(result, "d")).toBe("-----------|")
    })
  })

  it("errors when the outter stream errors", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const sourceStr = "--#"
      const source = cold(sourceStr) as any
      const result = collect<string, string>()(source)
      expectObservable(getGroupedObservable(result, "foo")).toBe("--#")
    })
  })

  it("completes when the outter stream completes", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const sourceStr = "--|"
      const source = cold(sourceStr) as any
      const result = collect<string, string>()(source)
      expectObservable(getGroupedObservable(result, "bar")).toBe("--|")
    })
  })
})

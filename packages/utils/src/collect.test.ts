import {
  map,
  shareReplay,
  skip,
  startWith,
  ignoreElements,
} from "rxjs/operators"
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

  it("emits a map with the latest filtered grouped stream", () => {
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
      const expectedStr = "ef--g-i--(k|)"
      const excluded = ["a", "c"]

      const source = cold(sourceStr, { a, b, c, d }).pipe(skip(1), startWith(a))
      const result = source.pipe(
        collect((inner$) =>
          inner$.pipe(
            ignoreElements(),
            startWith(!excluded.includes(inner$.key)),
          ),
        ),
        map((x) => Object.fromEntries(x.entries())),
      )

      expectObservable(result).toBe(expectedStr, {
        e: {},
        f: { b },
        g: {},
        i: { d },
        k: {},
      })
    })
  })
  describe("collect/get", () => {
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
        const source = cold(sourceStr, { a, b, c, d }).pipe(
          skip(1),
          startWith(a),
        )
        const result = collect<string, string>()(source)
        result.subscribe()
        expectObservable(result.get("a")).toBe("-------|")
        expectObservable(result.get("b")).toBe("---|")
        expectObservable(result.get("c")).toBe("------|")
        expectObservable(result.get("d")).toBe("-----------|")
      })
    })

    it("errors when the outter stream errors", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const sourceStr = "--#"
        const source = cold(sourceStr) as any
        const result = collect<string, string>()(source)
        expectObservable(result.get("foo")).toBe("--#")
      })
    })

    it("completes when the outter stream completes", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const sourceStr = "--|"
        const source = cold(sourceStr) as any
        const result = collect<string, string>()(source)
        expectObservable(result.get("bar")).toBe("--|")
      })
    })
  })
})

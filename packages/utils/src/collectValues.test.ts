import { map, takeWhile } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { split, collectValues } from "./"
import { from } from "rxjs"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("collectValues", () => {
  it("emits a map with the latest value for each group", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const values = {
        a: {
          key: "group1",
          quantity: 1,
        },
        b: {
          key: "group2",
          quantity: 2,
        },
        c: {
          key: "group1",
          quantity: 3,
        },
      }
      const source = cold("--a-b-c-|", values)
      const expected = "   p-m-n-o-(p|)"

      const result = source.pipe(
        split(
          (value) => value.key,
          (value$) => value$.pipe(map((value) => value.quantity)),
        ),
        collectValues(),
        map((groups) =>
          Array.from(groups.entries())
            .map(([key, value]) => `${key}:${value}`)
            .join(","),
        ),
      )

      expectObservable(result).toBe(expected, {
        m: "group1:1",
        n: "group1:1,group2:2",
        o: "group1:3,group2:2",
        p: "",
      })
    })
  })

  it("handles synchronous values", () => {
    scheduler().run(({ expectObservable }) => {
      const source = from([
        {
          key: "group1",
          quantity: 1,
        },
        {
          key: "group2",
          quantity: 2,
        },
        {
          key: "group1",
          quantity: 3,
        },
      ] as Array<{ key: string; quantity: number }>)

      const expected = "(mnop|)"

      const result = source.pipe(
        split(
          (value) => value.key,
          (value$) => value$.pipe(map((value) => value.quantity)),
        ),
        collectValues(),
        map((groups) =>
          Array.from(groups.entries())
            .map(([key, value]) => `${key}:${value}`)
            .join(","),
        ),
      )

      expectObservable(result).toBe(expected, {
        m: "group1:1",
        n: "group1:1,group2:2",
        o: "group1:3,group2:2",
        p: "",
      })
    })
  })

  it("propagates errors", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const values = {
        a: {
          key: "group1",
          quantity: 1,
        },
        b: {
          key: "group2",
          quantity: 2,
        },
        c: {
          key: "group1",
          quantity: 3,
        },
      }
      const source = cold("-a-b-c-#", values)
      const expected = "   pm-n-o-#"

      const result = source.pipe(
        split(
          (value) => value.key,
          (value$) => value$.pipe(map((value) => value.quantity)),
        ),
        collectValues(),
        map((groups) =>
          Array.from(groups.entries())
            .map(([key, value]) => `${key}:${value}`)
            .join(","),
        ),
      )

      expectObservable(result).toBe(expected, {
        m: "group1:1",
        n: "group1:1,group2:2",
        o: "group1:3,group2:2",
        p: "",
      })
    })
  })

  it("removes an entry when the projection function for that key completes", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const values = {
        a: {
          key: "group1",
          quantity: 1,
        },
        b: {
          key: "group2",
          quantity: 2,
        },
        c: {
          key: "group1",
          quantity: 3,
        },
      }
      const source = cold("-a-b-c", values)
      const expected = "   pm-n-o"

      const result = source.pipe(
        split(
          (value) => value.key,
          (value$) =>
            value$.pipe(
              map((value) => value.quantity),
              takeWhile((v) => v < 3),
            ),
        ),
        collectValues(),
        map((groups) =>
          Array.from(groups.entries())
            .map(([key, value]) => `${key}:${value}`)
            .join(","),
        ),
      )

      expectObservable(result).toBe(expected, {
        m: "group1:1",
        n: "group1:1,group2:2",
        o: "group2:2",
        p: "",
      })
    })
  })
})

import { map, takeWhile } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { groupInMap } from "./groupInMap"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("groupInMap", () => {
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
      const source = cold("a-b-c-|", values)
      const expected = "   m-n-o-(pq|)"

      const result = source.pipe(
        groupInMap(
          (value) => value.key,
          (value$) => value$.pipe(map((value) => value.quantity)),
        ),
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
        p: "group2:2", // TODO - I don't think this should be expected
        q: "",
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
      const source = cold("a-b-c", values)
      const expected = "   m-n-o"

      const result = source.pipe(
        groupInMap(
          (value) => value.key,
          (value$) =>
            value$.pipe(
              map((value) => value.quantity),
              takeWhile((v) => v < 3),
            ),
        ),
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
      })
    })
  })
})

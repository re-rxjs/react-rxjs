import { Observable } from "rxjs"
import { map, scan } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { combineKeys } from "./"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("combineKeys", () => {
  it("emits a map with the latest value of the stream of each key", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = cold("  ab---cd---").pipe(scan((acc, v) => [...acc, v], []))
      const a = cold("     --1---2---")
      const b = cold("      ---------")
      const c = cold("          1----")
      const d = cold("           9---")
      const expectedStr = "--e--f(gh)"

      const innerStreams = { a, b, c, d }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "1" },
        f: { a: "1", c: "1" },
        g: { a: "2", c: "1" },
        h: { a: "2", c: "1", d: "9" },
      })
    })
  })

  it("removes the entry of a key when that key is removed from the source", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = cold("  a-b---c---").pipe(map((v) => [v]))
      const a = cold("     ----------")
      const b = cold("       -1-2-3-4")
      const c = cold("           -2-3")
      const expectedStr = "---e-fgh-i"

      const innerStreams = { a, b, c }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { b: "1" },
        f: { b: "2" },
        g: {},
        h: { c: "2" },
        i: { c: "3" },
      })
    })
  })

  it("completes when the key stream completes", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = cold("  a-b---|").pipe(scan((acc, v) => [...acc, v], []))
      const a = cold("     -1-----")
      const b = cold("       -1---")
      const expectedStr = "-e-f--|"

      const innerStreams = { a, b }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "1" },
        f: { a: "1", b: "1" },
      })
    })
  })

  it("propagates errors from the inner streams", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = cold("  a-b---|").pipe(scan((acc, v) => [...acc, v], []))
      const a = cold("     -1-----")
      const b = cold("       -#")
      const expectedStr = "-e-#"

      const innerStreams = { a, b }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "1" },
      })
    })
  })

  it("propagates errors from the key stream", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = cold("  a-b#").pipe(scan((acc, v) => [...acc, v], []))
      const a = cold("     -1--")
      const b = cold("       -1")
      const expectedStr = "-e-#"

      const innerStreams = { a, b }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "1" },
      })
    })
  })
})

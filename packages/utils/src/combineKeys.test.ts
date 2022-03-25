import { concat, NEVER, Observable, of } from "rxjs"
import { map, scan } from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { combineKeys, KeyChanges } from "./"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("combineKeys", () => {
  it("emits a map with the latest value of the stream of each key", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = cold("  ab---cd---").pipe(
        scan((acc, v) => [...acc, v], [] as Array<string>),
      )
      const a = cold("     --1---2---")
      const b = cold("      ---------")
      const c = cold("          1----")
      const d = cold("           9---")
      const expectedStr = "--e--f(gh)"

      const innerStreams: Record<string, Observable<string>> = { a, b, c, d }

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

  it("doesn't emit if the inner value hasn't changed", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = cold("  ab---cd---").pipe(
        scan((acc, v) => [...acc, v], [] as Array<string>),
      )
      const a = cold("     --11112---")
      const b = cold("      ---------")
      const c = cold("          1----")
      const d = cold("           9---")
      const expectedStr = "--e--f(gh)"

      const innerStreams: Record<string, Observable<string>> = { a, b, c, d }

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

  it("does not emit more than once synchronously on subscribe", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const keys = concat(of(["a", "b", "c"]), NEVER)
      const a = of("1", "2", "3")
      const b = of("4")
      const c = cold("     ---5")
      const expectedStr = "e--f"

      const innerStreams: Record<string, Observable<string>> = { a, b, c }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "3", b: "4" },
        f: { a: "3", b: "4", c: "5" },
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

      const innerStreams: Record<string, Observable<string>> = { a, b, c }

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
      const keys = cold("  a-b---|").pipe(
        scan((acc, v) => [...acc, v], [] as Array<string>),
      )
      const a = cold("     -1-----")
      const b = cold("       -1---")
      const expectedStr = "-e-f--|"

      const innerStreams: Record<string, Observable<string>> = { a, b }

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
      const keys = cold("  a-b---|").pipe(
        scan((acc, v) => [...acc, v], [] as Array<string>),
      )
      const a = cold("     -1-----")
      const b = cold("       -#")
      const expectedStr = "-e-#"

      const innerStreams: Record<string, Observable<string>> = { a, b }

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
      const keys = cold("  a-b#").pipe(
        scan((acc, v) => [...acc, v], [] as Array<string>),
      )
      const a = cold("     -1--")
      const b = cold("       -1")
      const expectedStr = "-e-#"

      const innerStreams: Record<string, Observable<string>> = { a, b }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "1" },
      })
    })
  })

  it("accounts for reentrant keys", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const activeKeys = {
        a: ["a"],
        b: ["a", "b"],
        z: [],
      }

      const keys = cold("  abzab", activeKeys)
      const a = cold("     1----")
      const b = cold("      2---")
      const expectedStr = "efgef"

      const innerStreams: Record<string, Observable<string>> = { a, b }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "1" },
        f: { a: "1", b: "2" },
        g: {},
      })
    })
  })

  it("emits an empty map if the initial keys are an empty iterator", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const activeKeys = {
        a: ["a"],
        b: ["a", "b"],
        z: [],
      }

      const keys = cold("  zzabzzab", activeKeys)
      const a = cold("       1----")
      const b = cold("        2---")
      const expectedStr = "g-efg-ef"

      const innerStreams: Record<string, Observable<string>> = { a, b }

      const result = combineKeys(
        keys,
        (v): Observable<string> => innerStreams[v],
      ).pipe(map((x) => Object.fromEntries(x.entries())))

      expectObservable(result).toBe(expectedStr, {
        e: { a: "1" },
        f: { a: "1", b: "2" },
        g: {},
      })
    })
  })

  describe("change set", () => {
    it("contains all of the keys initially present in the stream", () => {
      scheduler().run(({ expectObservable }) => {
        const keys = concat(of(["a", "b", "c"]), NEVER)

        const result = combineKeys(keys, (v) => of(v)).pipe(
          map((x) => Array.from(x.changes)),
        )

        expectObservable(result).toBe("x", {
          x: ["a", "b", "c"],
        })
      })
    })

    it("only contains those values that have changed from the previous emission", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const keys = concat(of(["a", "b", "c"]), NEVER)
        const a = concat(["1"], cold("--2--"))
        const b = concat(["1"], cold("---2-"))
        const c = concat(["1"], cold("-----"))
        const expected = "            x-yz-"
        const streams: Record<string, Observable<string>> = { a, b, c }

        const result = combineKeys(keys, (v) => streams[v]).pipe(
          map((x) => Array.from(x.changes)),
        )

        expectObservable(result).toBe(expected, {
          x: ["a", "b", "c"],
          y: ["a"],
          z: ["b"],
        })
      })
    })

    it("contains removed keys", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const keys = cold("x--y-", {
          x: ["a", "b", "c"],
          y: ["b"],
        })
        const expected = " x--y-"

        const result = combineKeys(keys, (v) => of(v)).pipe(
          map((x) => Array.from(x.changes)),
        )

        expectObservable(result).toBe(expected, {
          x: ["a", "b", "c"],
          y: ["a", "c"],
        })
      })
    })
  })

  describe("with deltas", () => {
    it("emits a map with the latest value of the stream of each key added", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const keys = cold<KeyChanges<string>>("  ab---cd---", {
          a: {
            type: "add",
            keys: ["a"],
          },
          b: {
            type: "add",
            keys: ["b"],
          },
          c: {
            type: "add",
            keys: ["c"],
          },
          d: {
            type: "add",
            keys: ["d"],
          },
        })
        const a = cold("     --1---2---")
        const b = cold("      ---------")
        const c = cold("          1----")
        const d = cold("           9---")
        const expectedStr = "--e--f(gh)"

        const innerStreams: Record<string, Observable<string>> = { a, b, c, d }

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

    it("removes the entry of a key when that key is removed", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const expectedStr = "                  e-f-g-h-"
        const keys = cold<KeyChanges<string>>("a-b-c-d-", {
          a: {
            type: "add",
            keys: ["a"],
          },
          b: {
            type: "add",
            keys: ["b"],
          },
          c: {
            type: "remove",
            keys: ["a"],
          },
          d: {
            type: "remove",
            keys: ["b"],
          },
        })

        const result = combineKeys(keys, (v): Observable<string> => of(v)).pipe(
          map((x) => Object.fromEntries(x.entries())),
        )

        expectObservable(result).toBe(expectedStr, {
          e: { a: "a" },
          f: { a: "a", b: "b" },
          g: { b: "b" },
          h: {},
        })
      })
    })

    it("accepts more than one key change at a time", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const expectedStr = "                  e-f-"
        const keys = cold<KeyChanges<string>>("a-b-", {
          a: {
            type: "add",
            keys: ["a", "b", "c"],
          },
          b: {
            type: "remove",
            keys: ["c", "b"],
          },
        })

        const result = combineKeys(keys, (v): Observable<string> => of(v)).pipe(
          map((x) => Object.fromEntries(x.entries())),
        )

        expectObservable(result).toBe(expectedStr, {
          e: { a: "a", b: "b", c: "c" },
          f: { a: "a" },
        })
      })
    })

    it("omits removing keys that don't exist", () => {
      scheduler().run(({ expectObservable, cold }) => {
        const expectedStr = "                  e---"
        const keys = cold<KeyChanges<string>>("a-b-", {
          a: {
            type: "add",
            keys: ["a"],
          },
          b: {
            type: "remove",
            keys: ["b"],
          },
        })

        const result = combineKeys(keys, (v): Observable<string> => of(v)).pipe(
          map((x) => Object.fromEntries(x.entries())),
        )

        expectObservable(result).toBe(expectedStr, {
          e: { a: "a" },
        })
      })
    })
  })
})

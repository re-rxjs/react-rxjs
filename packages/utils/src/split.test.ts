import { TestScheduler } from "rxjs/testing"
import { split } from "./"
import { of, from } from "rxjs"
import { take, mergeMap, map } from "rxjs/operators"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("split", () => {
  it("should group numbers by odd/even", () => {
    scheduler().run(({ expectObservable, cold, hot }) => {
      const e1 = hot("  --1---2---3---4---5---|")
      const expected = "--x---y---------------|"
      const x = cold("    1-------3-------5---|")
      const y = cold("        2-------4-------|")
      const expectedValues = { x: x, y: y }
      const source = e1.pipe(split((val: string) => parseInt(val) % 2))
      expectObservable(source).toBe(expected, expectedValues)
    })
  })

  it("should complete the inner subjects when the outer subscriber unsubscribes", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const e1 = cold("  --1---2---3---4")
      const expected = " --x---(y|)"
      const x = cold("     1---|")
      const y = cold("         (2|)")
      const expectedValues = { x: x, y: y }
      const source = e1.pipe(
        split((val: string) => parseInt(val) % 2),
        take(2),
      )
      expectObservable(source).toBe(expected, expectedValues)
    })
  })

  it("should group values", (done) => {
    const expectedGroups = [
      { key: 1, values: [1, 3] },
      { key: 0, values: [2] },
    ]

    of(1, 2, 3)
      .pipe(split((x: number) => x % 2))
      .subscribe(
        (g: any) => {
          const expectedGroup = expectedGroups.shift()!
          expect(g.key).toBe(expectedGroup.key)

          g.subscribe((x: any) => {
            expect(x).toEqual(expectedGroup.values.shift())
          })
        },
        null,
        done,
      )
  })

  it("should group values while the inner stream does not complete", () => {
    const expectedGroups = [
      { key: 1, values: [1, 3] },
      { key: 0, values: [2, 4] },
      { key: 1, values: [5] },
      { key: 0, values: [6] },
    ]

    const resultingGroups: { key: number; values: number[] }[] = []

    of(1, 2, 3, 4, 5, 6)
      .pipe(split((x: number) => x % 2, take(2)))
      .subscribe((g: any) => {
        let group = { key: g.key, values: [] as number[] }

        g.subscribe((x: any) => {
          group.values.push(x)
        })

        resultingGroups.push(group)
      })

    expect(resultingGroups).toEqual(expectedGroups)
  })

  it("should group values while the inner stream does error", () => {
    const expectedGroups = [
      { key: 1, values: [1, 3] },
      { key: 0, values: [2, 4] },
      { key: 1, values: [7, 9] },
      { key: 0, values: [8, 10] },
    ]

    const resultingGroups: { key: number; values: number[] }[] = []

    of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
      .pipe(
        split(
          (x: number) => x % 2,
          map((val, idx) => {
            if (idx === 2) {
              throw new Error("Boom!")
            }
            return val
          }),
        ),
      )
      .subscribe((g: any) => {
        let group = { key: g.key, values: [] as number[] }

        g.subscribe((x: any) => {
          group.values.push(x)
        })

        resultingGroups.push(group)
      })

    expect(resultingGroups).toEqual(expectedGroups)
  })

  it("should group values with a keySelector, inners propagate error from outer", () => {
    const values = {
      a: "  foo",
      b: " FoO ",
      c: "baR  ",
      d: "foO ",
      e: " Baz   ",
      f: "  qux ",
      g: "   bar",
      h: " BAR  ",
      i: "FOO ",
      j: "baz  ",
      k: " bAZ ",
      l: "    fOo    ",
    }
    scheduler().run(({ expectSubscriptions, expectObservable, cold, hot }) => {
      const e1 = hot("-1--2--^-a-b-c-d-e-f-g-h-i-j-k-l-#", values)
      const e1subs = "       ^-------------------------!"
      const expected = "     --w---x---y-z-------------#"
      const w = cold("         a-b---d---------i-----l-#", values)
      const x = cold("             c-------g-h---------#", values)
      const y = cold("                 e---------j-k---#", values)
      const z = cold("                   f-------------#", values)
      const expectedValues = { w: w, x: x, y: y, z: z }

      const source = e1.pipe(split((val: string) => val.toLowerCase().trim()))

      expectObservable(source).toBe(expected, expectedValues)
      expectSubscriptions(e1.subscriptions).toBe(e1subs)
    })
  })

  it("should handle an empty Observable", () => {
    scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
      const e1 = cold(" |")
      const e1subs = "  (^!)"
      const expected = "|"

      const source = e1.pipe(split((val: string) => val.toLowerCase().trim()))

      expectObservable(source).toBe(expected)
      expectSubscriptions(e1.subscriptions).toBe(e1subs)
    })
  })

  it("should handle a never Observable", () => {
    scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
      const e1 = cold(" -")
      const e1subs = "  ^"
      const expected = "-"

      const source = e1.pipe(split((val: string) => val.toLowerCase().trim()))

      expectObservable(source).toBe(expected)
      expectSubscriptions(e1.subscriptions).toBe(e1subs)
    })
  })

  it("should handle a just-throw Observable", () => {
    scheduler().run(({ expectSubscriptions, expectObservable, cold }) => {
      const e1 = cold(" #")
      const e1subs = "  (^!)"
      const expected = "#"

      const source = e1.pipe(split((val: string) => val.toLowerCase().trim()))

      expectObservable(source).toBe(expected)
      expectSubscriptions(e1.subscriptions).toBe(e1subs)
    })
  })

  it("should unsubscribe from the source when the outer and inner subscriptions are disposed", () => {
    const values = {
      a: "  foo",
      b: " FoO ",
      c: "baR  ",
      d: "foO ",
      e: " Baz   ",
      f: "  qux ",
      g: "   bar",
      h: " BAR  ",
      i: "FOO ",
      j: "baz  ",
      k: " bAZ ",
      l: "    fOo    ",
    }
    scheduler().run(({ expectSubscriptions, expectObservable, hot }) => {
      const e1 = hot("-1--2--^-a-b-c-d-e-f-g-h-i-j-k-l-|", values)
      const e1subs = "       ^-!"
      const expected = "     --(a|)"

      const source = e1.pipe(
        split((val) => val.toLowerCase().trim()),
        take(1),
        mergeMap((group) => group.pipe(take(1))),
      )

      expectObservable(source).toBe(expected, values)
      expectSubscriptions(e1.subscriptions).toBe(e1subs)
    })
  })

  it("should allow outer to be unsubscribed early", () => {
    const values = {
      a: "  foo",
      b: " FoO ",
      c: "baR  ",
      d: "foO ",
      e: " Baz   ",
      f: "  qux ",
      g: "   bar",
      h: " BAR  ",
      i: "FOO ",
      j: "baz  ",
      k: " bAZ ",
      l: "    fOo    ",
    }
    scheduler().run(({ expectSubscriptions, expectObservable, hot }) => {
      const e1 = hot("-1--2--^-a-b-c-d-e-f-g-h-i-j-k-l-|", values)
      const unsub = "        -----------!"
      const e1subs = "       ^----------!"
      const expected = "     --w---x---y-"
      const expectedValues = { w: "foo", x: "bar", y: "baz" }

      const source = e1.pipe(
        split((val: string) => val.toLowerCase().trim()),
        map((group: any) => group.key),
      )

      expectObservable(source, unsub).toBe(expected, expectedValues)
      expectSubscriptions(e1.subscriptions).toBe(e1subs)
    })
  })

  it("should handle synchronous values", () => {
    scheduler().run(({ expectObservable, cold }) => {
      const e1 = from(["1", "2", "3", "4", "5"])
      const expected = "(xy|)"
      const x = cold("(135|)")
      const y = cold("(24|)")
      const expectedValues = { x: x, y: y }
      const source = e1.pipe(split((val: string) => parseInt(val) % 2))
      expectObservable(source).toBe(expected, expectedValues)
    })
  })
})

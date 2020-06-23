import { connectFactoryObservable } from "../src"
import { from, of, defer, concat, BehaviorSubject } from "rxjs"
import { renderHook, act } from "@testing-library/react-hooks"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectFactoryObservable", () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = (...args: any) => {
      if (/Consider adding an error/.test(args[0])) {
        return
      }
      originalError.call(console, ...args)
    }
  })

  afterAll(() => {
    console.error = originalError
  })
  describe("hook", () => {
    it("returns the latest emitted value", async () => {
      const [useNumber] = connectFactoryObservable((id: number) => of(id))
      const { result } = renderHook(() => useNumber(1))
      expect(result.current).toBe(1)
    })

    it("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
      let nInitCount = 0
      const observable$ = defer(() => {
        nInitCount += 1
        return from([1, 2, 3, 4, 5])
      })

      const [useLatestNumber] = connectFactoryObservable(
        (id: number) => concat(observable$, of(id)),
        {
          unsubscribeGraceTime: 100,
        },
      )
      const { unmount } = renderHook(() => useLatestNumber(6))
      const { unmount: unmount2 } = renderHook(() => useLatestNumber(6))
      const { unmount: unmount3 } = renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(1)
      unmount()
      unmount2()
      unmount3()

      await wait(90)
      const { unmount: unmount4 } = renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(1)
      unmount4()

      await wait(110)
      renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(2)
    })

    it("allows errors to be caught in error boundaries", () => {
      const errStream = new BehaviorSubject(1)
      const [useError] = connectFactoryObservable(() => errStream)

      renderHook(() => useError())

      expect(() =>
        act(() => {
          errStream.error("error")
        }),
      ).toThrow()
    })

    it("doesn't throw errors on components that will get unmounted on the next cycle", () => {
      const errStream = new BehaviorSubject(1)
      const [useError] = connectFactoryObservable(() => errStream)

      const { unmount } = renderHook(() => useError())

      expect(() =>
        act(() => {
          errStream.error("error")
          unmount()
        }),
      ).not.toThrow()
    })
  })
  describe("observable", () => {
    it("returns a factory of BehaviorObservables", () => {
      const [, getShared] = connectFactoryObservable((x: number) => of(x))
      expect((getShared(0) as any).getValue).toBeInstanceOf(Function)
    })

    it("if the source observable completes it keeps emitting the latest value until there are no more subscriptions", () => {
      let diff = -1
      const [, getShared] = connectFactoryObservable((_: number) => {
        diff++
        return from([1, 2, 3, 4].map(val => val + diff))
      })

      let latestValue1: number = 0
      let nUpdates = 0
      const sub1 = getShared(0).subscribe(x => {
        latestValue1 = x
        nUpdates += 1
      })
      expect(latestValue1).toBe(4)
      expect(nUpdates).toBe(4)

      let latestValue2: number = 0
      const sub2 = getShared(0).subscribe(x => {
        latestValue2 = x
        nUpdates += 1
      })
      expect(latestValue2).toBe(4)
      expect(nUpdates).toBe(5)

      sub1.unsubscribe()
      sub2.unsubscribe()

      let latestValue3: number = 0
      const sub3 = getShared(0).subscribe(x => {
        latestValue3 = x
        nUpdates += 1
      })
      expect(latestValue3).toBe(5)
      expect(nUpdates).toBe(9)
      sub3.unsubscribe()
    })
  })
})

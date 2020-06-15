import { connectFactoryObservable } from "../src"
import { from, of, defer, concat, BehaviorSubject } from "rxjs"
import { renderHook, act } from "@testing-library/react-hooks"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
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

    await wait(101)
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

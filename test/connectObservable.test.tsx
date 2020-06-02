import { connectObservable } from "../src"
import { NEVER, from, of, defer } from "rxjs"
import { renderHook, act } from "@testing-library/react-hooks"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
  it("returns the initial value when the stream has not emitted anything", async () => {
    const [useSomething] = connectObservable(NEVER, "initialValue")
    const { result } = renderHook(() => useSomething())

    expect(result.current).toBe("initialValue")
  })

  it("sets the initial state synchronously if it's available", async () => {
    const observable$ = of(1)
    const [useLatestNumber] = connectObservable(observable$, 0)

    const { result } = renderHook(() => useLatestNumber())
    expect(result.current).toEqual(1)
  })

  it("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
    let nInitCount = 0
    const observable$ = defer(() => {
      nInitCount += 1
      return from([1, 2, 3, 4, 5])
    })

    const [useLatestNumber] = connectObservable(observable$, 0, {
      unsubscribeGraceTime: 100,
    })
    const { unmount } = renderHook(() => useLatestNumber())
    const { unmount: unmount2 } = renderHook(() => useLatestNumber())
    const { unmount: unmount3 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount()
    unmount2()
    unmount3()

    await act(async () => {
      await wait(90)
    })
    const { unmount: unmount4 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount4()

    await act(async () => {
      await wait(101)
    })
    renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(2)
  })
})

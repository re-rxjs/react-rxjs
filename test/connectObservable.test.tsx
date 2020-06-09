import { connectObservable } from "../src"
import { from, of, defer } from "rxjs"
import { renderHook } from "@testing-library/react-hooks"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
  it("sets the initial state synchronously if it's available", async () => {
    const observable$ = of(1)
    const [useLatestNumber] = connectObservable(observable$)

    const { result } = renderHook(() => useLatestNumber())
    expect(result.current).toEqual(1)
  })

  it("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
    let nInitCount = 0
    const observable$ = defer(() => {
      nInitCount += 1
      return from([1, 2, 3, 4, 5])
    })

    const [useLatestNumber] = connectObservable(observable$, {
      unsubscribeGraceTime: 100,
    })
    const { unmount } = renderHook(() => useLatestNumber())
    const { unmount: unmount2 } = renderHook(() => useLatestNumber())
    const { unmount: unmount3 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount()
    unmount2()
    unmount3()

    await wait(90)
    const { unmount: unmount4 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount4()

    await wait(101)
    renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(2)
  })
})

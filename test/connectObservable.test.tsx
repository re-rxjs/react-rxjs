import { connectObservable } from "../src"
import { NEVER, from, of, defer, Subject } from "rxjs"
import { renderHook, act } from "@testing-library/react-hooks"
import { useState, useLayoutEffect } from "react"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
  it("returns the initial value when the stream has not emitted anything", async () => {
    const [useSomething] = connectObservable(NEVER, "initialValue")
    const { result } = renderHook(() => useSomething())
    await act(async () => {
      await wait(0)
    })

    expect(result.current).toBe("initialValue")
  })

  it("returns the latest emitted value", async () => {
    const [useNumber] = connectObservable(of(1), 0)
    const { result } = renderHook(() => useNumber())
    await act(async () => {
      await wait(0)
    })
    expect(result.current).toBe(1)
  })

  it("sets the initial state synchronously if it's available", async () => {
    const observable$ = of(1)
    const [useLatestNumber] = connectObservable(observable$, 0)

    const { result, unmount } = renderHook(() => useLatestNumber())
    expect(result.current).toEqual(1)
    unmount()
  })

  it("batches synchronous updates", async () => {
    const observable$ = new Subject<number>()
    const [useLatestNumber] = connectObservable(observable$, 0)
    const useLatestNumberTest = () => {
      const latestNumber = useLatestNumber()
      const [emittedValues, setEmittedValues] = useState<number[]>([])
      useLayoutEffect(() => {
        setEmittedValues(prev => [...prev, latestNumber])
      }, [latestNumber])
      return emittedValues
    }

    const { result } = renderHook(() => useLatestNumberTest())
    expect(result.current).toEqual([0])
    await act(async () => {
      observable$.next(0)
      observable$.next(1)
      observable$.next(2)
      observable$.next(3)
      observable$.next(4)
      observable$.next(5)
      await wait(0)
    })
    expect(result.current).toEqual([0, 5])
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
    await act(async () => {
      await wait(0)
    })
    const { unmount: unmount2 } = renderHook(() => useLatestNumber())
    await act(async () => {
      await wait(0)
    })
    const { unmount: unmount3 } = renderHook(() => useLatestNumber())
    await act(async () => {
      await wait(0)
    })
    expect(nInitCount).toBe(1)
    unmount()
    unmount2()
    unmount3()

    await act(async () => {
      await wait(90)
    })
    const { unmount: unmount4 } = renderHook(() => useLatestNumber())
    await act(async () => {
      await wait(0)
    })
    expect(nInitCount).toBe(1)
    unmount4()

    await act(async () => {
      await wait(101)
    })
    renderHook(() => useLatestNumber())
    await act(async () => {
      await wait(0)
    })
    expect(nInitCount).toBe(2)
  })
})

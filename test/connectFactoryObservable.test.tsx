import { connectFactoryObservable } from "../src"
import { NEVER, from, of, defer, concat } from "rxjs"
import { renderHook, act } from "@testing-library/react-hooks"
import { useEffect, useState } from "react"
import { delay } from "rxjs/operators"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
  it("returns the initial value when the stream has not emitted anything", async () => {
    const [useSomething] = connectFactoryObservable(
      (id: number) => concat(NEVER, of(id)),
      "initialValue",
    )
    const { result } = renderHook(() => useSomething(5))
    await act(async () => {
      await wait(0)
    })

    expect(result.current).toBe("initialValue")
  })

  it("returns the latest emitted value", async () => {
    const [useNumber] = connectFactoryObservable((id: number) => of(id), 0)
    const { result } = renderHook(() => useNumber(1))
    await act(async () => {
      await wait(0)
    })
    expect(result.current).toBe(1)
  })

  it("batches the updates that happen on the same event-loop", async () => {
    const observable$ = from([1, 2, 3, 4, 5])
    const [useLatestNumber] = connectFactoryObservable(
      (id: number) => concat(observable$, of(id).pipe(delay(1000))),
      0,
    )
    const useLatestNumberTest = () => {
      const latestNumber = useLatestNumber(6)
      const [emittedValues, setEmittedValues] = useState<number[]>([])
      useEffect(() => {
        setEmittedValues(prev => [...prev, latestNumber])
      }, [latestNumber])
      return emittedValues
    }

    const { result } = renderHook(() => useLatestNumberTest())
    await act(async () => {
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

    const [useLatestNumber] = connectFactoryObservable(
      (id: number) => concat(observable$, of(id)),
      0,
      {
        unsubscribeGraceTime: 100,
      },
    )
    const { unmount } = renderHook(() => useLatestNumber(6))
    await act(async () => {
      await wait(0)
    })
    const { unmount: unmount2 } = renderHook(() => useLatestNumber(6))
    await act(async () => {
      await wait(0)
    })
    const { unmount: unmount3 } = renderHook(() => useLatestNumber(6))
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
    const { unmount: unmount4 } = renderHook(() => useLatestNumber(6))
    await act(async () => {
      await wait(0)
    })
    expect(nInitCount).toBe(1)
    unmount4()

    await act(async () => {
      await wait(101)
    })
    renderHook(() => useLatestNumber(6))
    await act(async () => {
      await wait(0)
    })
    expect(nInitCount).toBe(2)
  })
})

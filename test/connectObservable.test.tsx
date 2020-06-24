import { fireEvent, render, screen } from "@testing-library/react"
import { renderHook, act } from "@testing-library/react-hooks"
import React, { Suspense, useRef, useEffect } from "react"
import { BehaviorSubject, concat, defer, from, of, Subject } from "rxjs"
import { delay, mergeMapTo, scan, take } from "rxjs/operators"
import {
  connectObservable,
  suspend,
  suspended,
  switchMapSuspended,
} from "../src"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = (...args: any) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return
      }
      originalError.call(console, ...args)
    }
  })

  afterAll(() => {
    console.error = originalError
  })

  it("sets the initial state synchronously if it's available", async () => {
    const observable$ = of(1)
    const [useLatestNumber] = connectObservable(observable$)

    const { result } = renderHook(() => useLatestNumber())
    expect(result.current).toEqual(1)
  })

  it("Only update when the previous and current update are distinct according to the comparator function", async () => {
    interface TestUpdate {
      value: number
      valueToIgnore: string
    }
    const stream$ = new BehaviorSubject<TestUpdate>({
      value: 0,
      valueToIgnore: "A",
    })

    const compare = (a: TestUpdate, b: TestUpdate) => a.value === b.value
    const [useLatestValue] = connectObservable(stream$, { compare })
    const useLatestValueWithUpdates = () => {
      const nUpdates = useRef(0)
      const latestValue = useLatestValue()
      useEffect(() => {
        nUpdates.current++
      })
      return {
        latestValue,
        nUpdates,
      }
    }

    const { result } = renderHook(() => useLatestValueWithUpdates())
    expect(result.current.latestValue.valueToIgnore).toEqual("A")
    expect(result.current.latestValue.value).toEqual(0)
    expect(result.current.nUpdates.current).toEqual(1)

    act(() => {
      stream$.next({ value: 0, valueToIgnore: "B" })
    })

    //should not update to the latest value in the stream
    expect(result.current.latestValue.valueToIgnore).toEqual("A")
    expect(result.current.latestValue.value).toEqual(0)
    //should not trigger a react update
    expect(result.current.nUpdates.current).toEqual(1)

    act(() => {
      stream$.next({ value: 1, valueToIgnore: "B" })
    })
    expect(result.current.latestValue.valueToIgnore).toEqual("B")
    expect(result.current.latestValue.value).toEqual(1)
    expect(result.current.nUpdates.current).toEqual(2)
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

    await wait(110)
    renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(2)
  })

  it("works with suspense", async () => {
    const subject$ = new Subject()
    const source$ = concat(
      subject$.pipe(
        take(2),
        scan(a => a + 1, 0),
        switchMapSuspended(x => of(x).pipe(delay(100))),
      ),
      subject$.pipe(take(1), mergeMapTo(of(3).pipe(delay(100), suspended()))),
      subject$.pipe(take(1), mergeMapTo(suspend(of(4).pipe(delay(100))))),
    )
    const [useDelayedNumber] = connectObservable(source$)
    const Result: React.FC = () => <div>Result {useDelayedNumber()}</div>
    const TestSuspense: React.FC = () => {
      return (
        <div>
          <button onClick={() => subject$.next()}>Next</button>
          <Suspense fallback={<span>Waiting</span>}>
            <Result />
          </Suspense>
        </div>
      )
    }

    render(<TestSuspense />)

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    await wait(110)

    expect(screen.queryByText("Result 1")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    await wait(110)

    expect(screen.queryByText("Result 2")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    await wait(110)

    expect(screen.queryByText("Result 3")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    await wait(110)

    expect(screen.queryByText("Result 4")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
  })
})

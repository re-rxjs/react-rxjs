import {
  act as componentAct,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import { act, renderHook } from "@testing-library/react-hooks"
import React, { Suspense, useEffect, FC } from "react"
import {
  BehaviorSubject,
  defer,
  from,
  of,
  Subject,
  throwError,
  Observable,
} from "rxjs"
import { delay, scan, startWith, map, switchMap } from "rxjs/operators"
import { connectObservable, SUSPENSE } from "./"
import { TestErrorBoundary } from "./test-helpers/TestErrorBoundary"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = (...args: any) => {
      if (
        /Warning.*not wrapped in act/.test(args[0]) ||
        /Uncaught 'controlled error'/.test(args[0]) ||
        /using the error boundary .* TestErrorBoundary/.test(args[0])
      ) {
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

  it("suspends the component when the observable hasn't emitted yet.", async () => {
    const source$ = of(1).pipe(delay(100))
    const [useDelayedNumber] = connectObservable(source$)
    const Result: React.FC = () => <div>Result {useDelayedNumber()}</div>
    const TestSuspense: React.FC = () => {
      return (
        <Suspense fallback={<span>Waiting</span>}>
          <Result />
        </Suspense>
      )
    }

    render(<TestSuspense />)

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    await wait(110)

    expect(screen.queryByText("Result 1")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
  })

  it("updates with the last emitted value", async () => {
    const numberStream = new BehaviorSubject(1)
    const [useNumber] = connectObservable(numberStream)
    const { result } = renderHook(() => useNumber())
    expect(result.current).toBe(1)

    act(() => {
      numberStream.next(2)
    })
    expect(result.current).toBe(2)
  })

  it("updates more than one component", async () => {
    const value = new Subject<number>()
    const [useValue] = connectObservable(value.pipe(startWith(0)), 50)
    const { result: result1, unmount: unmount1 } = renderHook(() => useValue())
    const { result: result2, unmount: unmount2 } = renderHook(() => useValue())
    const { result: result3, unmount: unmount3 } = renderHook(() => useValue())
    const { result: result4, unmount: unmount4 } = renderHook(() => useValue())

    expect(result1.current).toBe(0)
    expect(result2.current).toBe(0)
    expect(result3.current).toBe(0)
    expect(result4.current).toBe(0)

    act(() => {
      value.next(1)
    })

    expect(result1.current).toBe(1)
    expect(result2.current).toBe(1)
    expect(result3.current).toBe(1)
    expect(result4.current).toBe(1)

    unmount1()
    unmount2()
    unmount3()
    unmount4()

    await act(async () => {
      await wait(60)
    })

    const { result: result2_1 } = renderHook(() => useValue())
    const { result: result2_2 } = renderHook(() => useValue())
    const { result: result2_3 } = renderHook(() => useValue())
    const { result: result2_4 } = renderHook(() => useValue())

    expect(result2_1.current).toBe(0)
    expect(result2_2.current).toBe(0)
    expect(result2_3.current).toBe(0)
    expect(result2_4.current).toBe(0)
  })

  it("allows React to batch synchronous updates", async () => {
    const numberStream = new BehaviorSubject(1)
    const stringStream = new BehaviorSubject("a")
    const [useNumber] = connectObservable(numberStream)
    const [useString] = connectObservable(stringStream)

    const BatchComponent: FC<{
      onUpdate: () => void
    }> = ({ onUpdate }) => {
      const number = useNumber()
      const string = useString()
      useEffect(onUpdate)
      return (
        <>
          {number} {string}
        </>
      )
    }

    const updates = jest.fn()
    render(<BatchComponent onUpdate={updates} />)
    expect(updates).toHaveBeenCalledTimes(1)

    componentAct(() => {
      numberStream.next(2)
      numberStream.next(3)
      stringStream.next("b")
    })
    expect(updates).toHaveBeenCalledTimes(2)
  })

  it("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
    let nInitCount = 0
    const observable$ = defer(() => {
      nInitCount += 1
      return from([1, 2, 3, 4, 5])
    })

    const [useLatestNumber] = connectObservable(observable$, 100)
    const { unmount } = renderHook(() => useLatestNumber())
    const { unmount: unmount2 } = renderHook(() => useLatestNumber())
    const { unmount: unmount3 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount()
    unmount2()
    unmount3()

    await wait(85)
    const { unmount: unmount4 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount4()

    await wait(125)
    renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(2)
  })

  it("it never closes the last subscription when the grace-period is Infinity", async () => {
    let nInitCount = 0
    const observable$ = defer(() => {
      nInitCount += 1
      return from([1, 2, 3, 4, 5])
    })

    const [useLatestNumber] = connectObservable(observable$, Infinity)
    const { unmount } = renderHook(() => useLatestNumber())
    const { unmount: unmount2 } = renderHook(() => useLatestNumber())
    const { unmount: unmount3 } = renderHook(() => useLatestNumber())
    const { unmount: unmount4 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount()
    unmount2()
    unmount3()
    unmount4()

    await wait(300)
    renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
  })

  it("suspends the component when the observable emits SUSPENSE", async () => {
    const subject$ = new Subject()
    const source$ = subject$.pipe(
      scan(a => a + 1, 0),
      map(x => {
        if (x === 1) {
          return SUSPENSE
        }
        return x
      }),
      startWith(0),
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

    expect(screen.queryByText("Result 0")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result 2")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
  })

  it("keeps in suspense if more than two SUSPENSE are emitted in succesion", async () => {
    const subject$ = new Subject()
    const source$ = subject$.pipe(
      scan(a => a + 1, 0),
      map(x => {
        if (x <= 2) {
          return SUSPENSE
        }
        return x
      }),
      startWith(0),
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

    expect(screen.queryByText("Result 0")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result 3")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
  })

  it("allows errors to be caught in error boundaries", () => {
    const errStream = new BehaviorSubject(1)
    const [useError] = connectObservable(errStream)

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = jest.fn()
    render(
      <TestErrorBoundary onError={errorCallback}>
        <ErrorComponent />
      </TestErrorBoundary>,
    )

    componentAct(() => {
      errStream.error("controlled error")
    })

    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
  })

  it("allows sync errors to be caught in error boundaries with suspense", () => {
    const errStream = new Observable(observer =>
      observer.error("controlled error"),
    )
    const [useError] = connectObservable(errStream)

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = jest.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Suspense>
      </TestErrorBoundary>,
    )

    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    unmount()
  })

  it("allows async errors to be caught in error boundaries with suspense", async () => {
    const errStream = new Subject()
    const [useError] = connectObservable(errStream)

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = jest.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Suspense>
      </TestErrorBoundary>,
    )

    await componentAct(async () => {
      errStream.error("controlled error")
      await wait(50)
    })

    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    unmount()
  })

  it("allows to retry the errored observable after a grace period of time", async () => {
    let errStream = new Subject<string>()
    const [useError] = connectObservable(
      defer(() => {
        return (errStream = new Subject<string>())
      }),
    )

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = jest.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Suspense>
      </TestErrorBoundary>,
    )

    expect(screen.queryByText("Loading...")).not.toBeNull()
    expect(screen.queryByText("ALL GOOD")).toBeNull()

    await componentAct(async () => {
      errStream.error("controlled error")
      await wait(50)
    })

    expect(screen.queryByText("Loading...")).toBeNull()
    expect(screen.queryByText("ALL GOOD")).toBeNull()
    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    unmount()

    errorCallback.mockReset()
    await componentAct(async () => {
      await wait(250)
    })

    render(
      <TestErrorBoundary onError={errorCallback}>
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Suspense>
      </TestErrorBoundary>,
    )
    expect(screen.queryByText("Loading...")).not.toBeNull()

    await componentAct(async () => {
      errStream.next("ALL GOOD")
      await wait(50)
    })

    expect(errorCallback).not.toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    expect(screen.queryByText("ALL GOOD")).not.toBeNull()
  })

  it("doesn't throw errors on components that will get unmounted on the next cycle", () => {
    const valueStream = new BehaviorSubject(1)
    const [useValue, value$] = connectObservable(valueStream)
    const [useError] = connectObservable(
      value$.pipe(switchMap(v => (v === 1 ? of(v) : throwError("error")))),
    )

    const ErrorComponent: FC = () => {
      const value = useError()

      return <>{value}</>
    }

    const Container: FC = () => {
      const value = useValue()

      return value === 1 ? <ErrorComponent /> : <>Nothing to show here</>
    }

    const errorCallback = jest.fn()
    render(
      <TestErrorBoundary onError={errorCallback}>
        <Container>
          <ErrorComponent />
        </Container>
      </TestErrorBoundary>,
    )

    componentAct(() => {
      valueStream.next(2)
    })

    expect(errorCallback).not.toHaveBeenCalled()
  })
})

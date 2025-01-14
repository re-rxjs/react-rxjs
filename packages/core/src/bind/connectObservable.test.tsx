import {
  act,
  act as componentAct,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import React, { FC, StrictMode, Suspense, useEffect, useState } from "react"
import { renderToPipeableStream } from "react-dom/server"
import {
  defer,
  EMPTY,
  from,
  lastValueFrom,
  merge,
  NEVER,
  Observable,
  of,
  Subject,
  throwError,
} from "rxjs"
import {
  catchError,
  delay,
  map,
  scan,
  startWith,
  switchMapTo,
} from "rxjs/operators"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  bind,
  sinkSuspense,
  Subscribe,
  SUSPENSE,
  useStateObservable,
} from "../"
import { pipeableStreamToObservable } from "../test-helpers/pipeableStreamToObservable"
import { TestErrorBoundary } from "../test-helpers/TestErrorBoundary"

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

describe("connectObservable", () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = (...args: any) => {
      if (
        /Warning.*not wrapped in act/.test(args[0]) ||
        /Uncaught 'controlled error'/.test(args[0]) ||
        /Missing subscription/.test(args[0]) ||
        /Empty observable/.test(args[0]) ||
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
    const [useLatestNumber, latestNumber$] = bind(observable$)
    const subs = latestNumber$.subscribe()

    const { result } = renderHook(() => useLatestNumber())
    expect(result.current).toEqual(1)
    subs.unsubscribe()
  })

  it("suspends the component when the observable hasn't emitted yet.", async () => {
    const source$ = of(1).pipe(delay(100))
    const [, delayedNumber$] = bind(source$)
    const sub = delayedNumber$.subscribe()
    const Result: React.FC = () => (
      <div>Result {useStateObservable(delayedNumber$)}</div>
    )
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

    vi.waitFor(
      () => {
        expect(screen.queryByText("Result 1")).not.toBeNull()
        expect(screen.queryByText("Waiting")).toBeNull()
      },
      { timeout: 2000 },
    )
    sub.unsubscribe()
  })

  it("suspends the component when the observable starts emitting suspense", async () => {
    const source$ = of(1).pipe(delay(100), startWith(SUSPENSE))
    const [useDelayedNumber, delayedNumber$] = bind(source$)
    const sub = delayedNumber$.subscribe()
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

    vi.waitFor(
      () => {
        expect(screen.queryByText("Result 1")).not.toBeNull()
        expect(screen.queryByText("Waiting")).toBeNull()
      },
      { timeout: 2000 },
    )
    sub.unsubscribe()
  })

  it("updates with the last emitted value", async () => {
    const numberStream = new Subject<number>()
    const [useNumber] = bind(numberStream, 1)
    const { result } = renderHook(() => useNumber())
    expect(result.current).toBe(1)

    act(() => {
      numberStream.next(2)
    })
    expect(result.current).toBe(2)
  })

  it("updates more than one component", async () => {
    const value = new Subject<number>()
    const [useValue] = bind(value, 0)
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
      await wait(260)
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
    const numberStream = new Subject<number>()
    const stringStream = new Subject<string>()
    const [useNumber] = bind(numberStream, 1)
    const [useString] = bind(stringStream, "a")

    const BatchComponent: FC = ({ onUpdate }) => {
      const number = useNumber()
      const string = useString()
      useEffect(onUpdate)
      return (
        <>
          {number} {string}
        </>
      )
    }

    const updates = vi.fn()
    render(<BatchComponent onUpdate={updates} />)
    expect(updates).toHaveBeenCalledTimes(1)

    componentAct(() => {
      numberStream.next(2)
      numberStream.next(3)
      stringStream.next("b")
    })
    expect(updates).toHaveBeenCalledTimes(2)
  })

  it("shares the source subscription until there are no more subscribers", async () => {
    let nInitCount = 0
    const observable$ = defer(() => {
      nInitCount += 1
      return from([1, 2, 3, 4, 5])
    })

    const [useLatestNumber, latestNumber$] = bind(observable$)
    let subs = latestNumber$.subscribe()
    const { unmount } = renderHook(() => useLatestNumber())
    const { unmount: unmount2 } = renderHook(() => useLatestNumber())
    const { unmount: unmount3 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount()
    unmount2()
    unmount3()

    const { unmount: unmount4 } = renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(1)
    unmount4()

    subs.unsubscribe()
    subs = latestNumber$.subscribe()
    renderHook(() => useLatestNumber())
    expect(nInitCount).toBe(2)
  })

  it("suspends the component when the observable emits SUSPENSE", async () => {
    const subject$ = new Subject<void>()
    const source$ = subject$.pipe(
      scan((a) => a + 1, 0),
      map((x) => {
        if (x === 1) {
          return SUSPENSE
        }
        return x
      }),
      startWith(0),
    )
    const [useDelayedNumber, delayedNumber$] = bind(source$)
    const Result: React.FC = () => <div>Result {useDelayedNumber()}</div>
    const TestSuspense: React.FC = () => {
      return (
        <div>
          <button onClick={() => subject$.next()}>Next</button>
          <Subscribe source$={delayedNumber$} fallback={<span>Waiting</span>}>
            <Result />
          </Subscribe>
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
    const subject$ = new Subject<void>()
    const source$ = subject$.pipe(
      scan((a) => a + 1, 0),
      map((x) => {
        if (x <= 2) {
          return SUSPENSE
        }
        return x
      }),
      startWith(0),
    )
    const [useDelayedNumber, delayedNumber$] = bind(source$)
    const Result: React.FC = () => <div>Result {useDelayedNumber()}</div>
    const TestSuspense: React.FC = () => {
      return (
        <div>
          <button onClick={() => subject$.next()}>Next</button>
          <Subscribe source$={delayedNumber$} fallback={<span>Waiting</span>}>
            <Result />
          </Subscribe>
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

  it("doesn't enter suspense if the observable emits a promise", async () => {
    const subject$ = new Subject<Promise>()
    const [usePromise, promise$] = bind(subject$, null)
    const Result: React.FC = () => {
      const value = usePromise()
      return (
        <div>
          {value === null
            ? "default"
            : value instanceof Promise
              ? "promise"
              : "wtf?"}
        </div>
      )
    }

    const TestSuspense: React.FC = () => {
      return (
        <div>
          <Subscribe source$={promise$} fallback={<span>Waiting</span>}>
            <Result />
          </Subscribe>
        </div>
      )
    }

    render(<TestSuspense />)

    expect(screen.queryByText("Waiting")).toBeNull()
    expect(screen.queryByText("default")).not.toBeNull()

    act(() => subject$.next(new Promise(() => {})))

    expect(screen.queryByText("Waiting")).toBeNull()
    expect(screen.queryByText("promise")).not.toBeNull()
  })

  it("correctly unsubscribes when the Subscribe component gets unmounted", async () => {
    const subject$ = new Subject<void>()
    const [useNumber, number$] = bind(subject$.pipe(scan((a) => a + 1, 0)))

    const Result: React.FC = () => <div>Result {useNumber()}</div>
    const TestSuspense: React.FC = () => {
      const [key, setKey] = useState(1)
      return (
        <div>
          <button onClick={() => setKey((x) => x + 1)}>NextKey</button>
          <button onClick={() => subject$.next()}>NextVal</button>
          <Subscribe
            key={key}
            source$={number$}
            fallback={<span>Waiting</span>}
          >
            <Result />
          </Subscribe>
        </div>
      )
    }

    render(<TestSuspense />)

    expect(screen.queryByText("Result 0")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/NextVal/i))

    await wait(10)

    vi.waitFor(() => {
      expect(screen.queryByText("Waiting")).toBeNull()
      expect(screen.queryByText("Result 1")).not.toBeNull()
    })

    fireEvent.click(screen.getByText(/NextVal/i))

    vi.waitFor(() => {
      expect(screen.queryByText("Result 2")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()
    })

    fireEvent.click(screen.getByText(/NextKey/i))

    await wait(10)

    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/NextVal/i))

    await wait(10)

    vi.waitFor(() => {
      expect(screen.queryByText("Result 1")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()
    })

    fireEvent.click(screen.getByText(/NextVal/i))

    vi.waitFor(() => {
      expect(screen.queryByText("Result 2")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()
    })
  })

  it("allows errors to be caught in error boundaries", () => {
    const errStream = new Subject()
    const [useError] = bind(errStream, 1)

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = vi.fn()
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

  it("allows sync errors to be caught in error boundaries with suspense, using source$", () => {
    const errStream = new Observable((observer) =>
      observer.error("controlled error"),
    )
    const [useError, errStream$] = bind(errStream)

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = vi.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Subscribe source$={errStream$} fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Subscribe>
      </TestErrorBoundary>,
    )

    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    unmount()
  })

  it("allows sync errors to be caught in error boundaries with suspense, without using source$", () => {
    const errStream = new Observable((observer) =>
      observer.error("controlled error"),
    )
    const [useError] = bind(errStream)

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = vi.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Subscribe fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Subscribe>
      </TestErrorBoundary>,
    )

    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    unmount()
  })

  it("allows sync errors to be caught in error boundaries when there is a default value", () => {
    const errStream = new Observable((observer) =>
      observer.error("controlled error"),
    )
    const [useError, errStream$] = bind(errStream, 0)

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = vi.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Subscribe source$={errStream$} fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Subscribe>
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
    const [useError, errStream$] = bind(errStream)
    const errStream$WithoutErrors = errStream$.pipe(catchError(() => NEVER))

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = vi.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Subscribe
          source$={errStream$WithoutErrors}
          fallback={<div>Loading...</div>}
        >
          <ErrorComponent />
        </Subscribe>
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
    const errStream = new Subject<string>()
    const nextStream = new Subject<string>()
    const [useError, error$] = bind(
      merge(
        errStream.pipe(
          map((x) => {
            throw x
          }),
        ),
        nextStream,
      ),
    )

    const ErrorComponent = () => {
      const value = useError()
      return <>{value}</>
    }

    const errorCallback = vi.fn()
    const { unmount } = render(
      <TestErrorBoundary onError={errorCallback}>
        <Subscribe source$={error$} fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Subscribe>
      </TestErrorBoundary>,
    )

    expect(screen.queryByText("Loading...")).not.toBeNull()
    expect(screen.queryByText("ALL GOOD")).toBeNull()

    await componentAct(async () => {
      errStream.next("controlled error")
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
      await wait(200)
    })

    render(
      <TestErrorBoundary onError={errorCallback}>
        <Subscribe source$={error$} fallback={<div>Loading...</div>}>
          <ErrorComponent />
        </Subscribe>
      </TestErrorBoundary>,
    )
    expect(screen.queryByText("Loading...")).not.toBeNull()

    await componentAct(async () => {
      nextStream.next("ALL GOOD")
      await wait(50)
    })

    expect(errorCallback).not.toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    expect(screen.queryByText("ALL GOOD")).not.toBeNull()
  })

  it("doesn't throw errors on components that will get unmounted on the next cycle", () => {
    const valueStream = new Subject<number>()
    const [useValue] = bind(valueStream, 1)
    const [useError] = bind(
      valueStream.pipe(switchMapTo(throwError("error"))),
      1,
    )

    const ErrorComponent: FC = () => {
      const value = useError()

      return <>{value}</>
    }

    const Container: FC = () => {
      const value = useValue()

      return value === 1 ? <ErrorComponent /> : <>Nothing to show here</>
    }

    const errorCallback = vi.fn()
    render(
      <TestErrorBoundary onError={errorCallback}>
        <Container />
      </TestErrorBoundary>,
    )

    componentAct(() => {
      valueStream.next(2)
    })

    expect(errorCallback).not.toHaveBeenCalled()
  })

  it("supports streams that emit functions", () => {
    const values$ = new Subject<number>()

    const [useFunction, function$] = bind(
      values$.pipe(
        startWith(0),
        map((value) => () => value),
      ),
    )
    const subscription = function$.subscribe()

    const { result, rerender } = renderHook(() => useFunction())

    expect(result.current()).toBe(0)

    values$.next(1)
    rerender()

    expect(result.current()).toBe(1)

    subscription.unsubscribe()
  })

  it("should throw an error when the stream does not have a subscription", () => {
    const [useValue] = bind(of("Hello"))
    const errorCallback = vi.fn()

    const Component: FC = () => <>{useValue()}</>
    render(
      <StrictMode>
        <TestErrorBoundary onError={errorCallback}>
          <Suspense fallback={<div>Loading...</div>}>
            <Component />
          </Suspense>
        </TestErrorBoundary>
        ,
      </StrictMode>,
    )

    expect(errorCallback).toHaveBeenCalled()
  })

  it("should throw an error if the stream completes without emitting while on SUSPENSE", async () => {
    const subject = new Subject()
    const [useValue, value$] = bind(subject)
    const errorCallback = vi.fn()

    const Component: FC = () => <>{useValue()}</>
    render(
      <StrictMode>
        <TestErrorBoundary onError={errorCallback}>
          <Subscribe source$={value$} fallback={<div>Loading...</div>}>
            <Component />
          </Subscribe>
        </TestErrorBoundary>
        ,
      </StrictMode>,
    )

    expect(errorCallback).not.toHaveBeenCalled()
    expect(screen.queryByText("Loading...")).not.toBeNull()

    await componentAct(async () => {
      subject.complete()
      await wait(100)
    })

    expect(screen.queryByText("Loading...")).toBeNull()
    expect(errorCallback).toHaveBeenCalled()
  })

  it("the defaultValue can be undefined", () => {
    const number$ = new Subject<number>()
    const [useNumber] = bind(number$, undefined)

    const { result, unmount } = renderHook(() => useNumber())

    expect(result.current).toBe(undefined)

    act(() => {
      number$.next(5)
    })

    expect(result.current).toBe(5)

    unmount()
  })

  it("if the observable hasn't emitted and a defaultValue is provided, it does not start suspense", () => {
    const number$ = new Subject<number>()
    const [useNumber] = bind(number$, 0)

    const { result, unmount } = renderHook(() => useNumber())

    expect(result.current).toBe(0)

    act(() => {
      number$.next(5)
    })

    expect(result.current).toBe(5)

    unmount()
  })

  it("when a defaultValue is provided, the first subscription happens once the component is mounted", () => {
    let nTopSubscriptions = 0

    const [useNTopSubscriptions] = bind(
      defer(() => of(++nTopSubscriptions)),
      1,
    )

    const { result, rerender, unmount } = renderHook(() =>
      useNTopSubscriptions(),
    )

    expect(result.current).toBe(1)

    act(() => {
      rerender()
    })

    expect(result.current).toBe(1)
    expect(nTopSubscriptions).toBe(1)

    unmount()
  })

  it("when a defaultValue is provided, the resulting observable should emmit the defaultValue first if the source doesn't synchronously emmit anything", () => {
    let value = 0
    let [, result$] = bind<number>(NEVER, 10)
    result$.subscribe((v) => {
      value = v
    })
    expect(value).toBe(10)

    value = 0
    ;[, result$] = bind(EMPTY, 10)
    result$.subscribe((v) => {
      value = v
    })

    value = 0
    ;[, result$] = bind(of(5), 10)
    result$.subscribe((v) => {
      value += v
    })
    expect(value).toBe(5)
  })

  it("enters suspense when the observable emits an effect", async () => {
    const subject$ = new Subject<number | SUSPENSE>()
    const [useValue] = bind(subject$.pipe(sinkSuspense()))
    const Result: React.FC = () => <div>Result {useValue()}</div>

    const TestSuspense: React.FC = () => {
      return (
        <Subscribe fallback={<span>Waiting</span>}>
          <Result />
        </Subscribe>
      )
    }

    const { queryByText } = render(<TestSuspense />)

    await act(async () => {
      subject$.next(0)
    })

    expect(queryByText("Result 0")).not.toBeNull()
    expect(queryByText("Waiting")).toBeNull()

    act(() => {
      subject$.next(SUSPENSE)
    })

    expect(queryByText("Waiting")).not.toBeNull()

    act(() => {
      subject$.next(1)
    })

    expect(queryByText("Result 1")).not.toBeNull()
    expect(queryByText("Waiting")).toBeNull()
  })

  it("ignores effects while waiting for the first value", async () => {
    const subject$ = new Subject<number | SUSPENSE>()
    const [useValue] = bind(subject$.pipe(sinkSuspense()))
    const Result: React.FC = () => <div>Result {useValue()}</div>

    const TestSuspense: React.FC = () => {
      return (
        <Subscribe fallback={<span>Waiting</span>}>
          <Result />
        </Subscribe>
      )
    }

    const { queryByText } = render(<TestSuspense />)

    expect(queryByText("Waiting")).not.toBeNull()

    await act(async () => {
      subject$.next(SUSPENSE)
    })
    expect(queryByText("Waiting")).not.toBeNull()

    await act(async () => {
      subject$.next(SUSPENSE)
      await wait(10)
      subject$.next(SUSPENSE)
    })
    expect(queryByText("Waiting")).not.toBeNull()

    await act(async () => {
      subject$.next(1)
    })
    expect(queryByText("Result 1")).not.toBeNull()
    expect(queryByText("Waiting")).toBeNull()
  })

  it("ignores effects after entering suspense", async () => {
    const subject$ = new Subject<number | SUSPENSE>()
    const [useValue] = bind(subject$.pipe(sinkSuspense()))
    const Result: React.FC = () => <div>Result {useValue()}</div>

    const TestSuspense: React.FC = () => {
      return (
        <Subscribe fallback={<span>Waiting</span>}>
          <Result />
        </Subscribe>
      )
    }

    const { queryByText } = render(<TestSuspense />)

    await act(async () => {
      subject$.next(0)
    })

    expect(queryByText("Result 0")).not.toBeNull()
    expect(queryByText("Waiting")).toBeNull()

    await act(async () => {
      subject$.next(SUSPENSE)
    })
    expect(queryByText("Waiting")).not.toBeNull()

    await act(async () => {
      subject$.next(SUSPENSE)
      await wait(10)
      subject$.next(SUSPENSE)
    })
    expect(queryByText("Waiting")).not.toBeNull()

    await act(async () => {
      subject$.next(1)
    })
    expect(queryByText("Result 1")).not.toBeNull()
    expect(queryByText("Waiting")).toBeNull()
  })

  it("emits the default value when an effect is received", () => {
    const subject$ = new Subject<number | SUSPENSE>()
    const [useValue] = bind(subject$.pipe(sinkSuspense()), 10)
    const Result: React.FC = () => <div>Result {useValue()}</div>

    const { queryByText } = render(<Result />)

    expect(queryByText("Result 10")).not.toBeNull()

    act(() => {
      subject$.next(5)
    })
    expect(queryByText("Result 5")).not.toBeNull()

    act(() => {
      subject$.next(SUSPENSE)
    })
    expect(queryByText("Result 10")).not.toBeNull()
  })

  describe("The hook on SSR", () => {
    // Testing-library doesn't support SSR yet https://github.com/testing-library/react-testing-library/issues/561

    it("returns the value if the state observable has a subscription", async () => {
      const [useState, state$] = bind(of(5))
      state$.subscribe()
      const Component = () => {
        const value = useState()
        return <div>Value: {value}</div>
      }
      const stream = renderToPipeableStream(<Component />)
      const result = await lastValueFrom(pipeableStreamToObservable(stream))

      // Sigh...
      expect(result).toEqual("<div>Value: <!-- -->5</div>")
    })

    it("throws Missing Subscribe if the state observable doesn't have a subscription nor a default value", async () => {
      const [useState] = bind(of(5))
      const Component = () => {
        const value = useState()
        return <div>Value: {value}</div>
      }
      const stream = renderToPipeableStream(<Component />)
      try {
        await lastValueFrom(pipeableStreamToObservable(stream))
      } catch (ex: any) {
        expect(ex.message).to.equal("Missing Subscribe!")
      }
      expect.assertions(1)
    })

    it("returns the default value if the observable didn't emit yet", async () => {
      const [useState] = bind(of(5), 3)
      const Component = () => {
        const value = useState()
        return <div>Value: {value}</div>
      }
      const stream = renderToPipeableStream(<Component />)
      const result = await lastValueFrom(pipeableStreamToObservable(stream))

      expect(result).toEqual("<div>Value: <!-- -->3</div>")
    })
  })
})

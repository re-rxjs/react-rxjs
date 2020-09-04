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
  of,
  Subject,
  throwError,
  Observable,
  concat,
} from "rxjs"
import { delay, scan, startWith, map, switchMap } from "rxjs/operators"
import { bind, SUSPENSE } from "@react-rxjs/core"
import { TestErrorBoundary } from "./test-helpers/TestErrorBoundary"
import { createSubscription, useSubscription } from "../src"

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

describe("resource", () => {
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
    const [, latestNumber$] = bind(observable$)
    const sub = createSubscription(latestNumber$)

    const { result } = renderHook(() => useSubscription(sub))
    expect(result.current).toEqual(1)
  })

  it("suspends the component when the observable hasn't emitted yet.", async () => {
    const source$ = of(1).pipe(delay(100))
    const [, delayedNumber$] = bind(source$)
    const sub = createSubscription(delayedNumber$);
    const Result: React.FC = () => <div>Result {useSubscription(sub)}</div>
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
    const [, number$] = bind(numberStream)
    const sub = createSubscription(number$);

    const { result } = renderHook(() => useSubscription(sub))
    expect(result.current).toBe(1)

    act(() => {
      numberStream.next(2)
    })
    expect(result.current).toBe(2)
  })

  it("updates more than one component", async () => {
    const value = new Subject<number>()
    const [, value$] = bind(value.pipe(startWith(0)), 50)
    const sub = createSubscription(value$);

    const { result: result1, unmount: unmount1 } = renderHook(() => useSubscription(sub))
    const { result: result2, unmount: unmount2 } = renderHook(() => useSubscription(sub))
    const { result: result3, unmount: unmount3 } = renderHook(() => useSubscription(sub))
    const { result: result4, unmount: unmount4 } = renderHook(() => useSubscription(sub))

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

    // Doesn't apply: unsubscription happens controlled by the consumer
    // await act(async () => {
    //   await wait(60)
    // })

    // const { result: result2_1 } = renderHook(() => useSubscription(sub))
    // const { result: result2_2 } = renderHook(() => useSubscription(sub))
    // const { result: result2_3 } = renderHook(() => useSubscription(sub))
    // const { result: result2_4 } = renderHook(() => useSubscription(sub))

    // expect(result2_1.current).toBe(0)
    // expect(result2_2.current).toBe(0)
    // expect(result2_3.current).toBe(0)
    // expect(result2_4.current).toBe(0)
  })

  it("allows React to batch synchronous updates", async () => {
    const numberStream = new BehaviorSubject(1)
    const stringStream = new BehaviorSubject("a")
    const [,number$] = bind(numberStream)
    const [,string$] = bind(stringStream)
    const subNumber = createSubscription(number$);
    const subString = createSubscription(string$)

    const BatchComponent: FC<{
      onUpdate: () => void
    }> = ({ onUpdate }) => {
      const number = useSubscription(subNumber)
      const string = useSubscription(subString)
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

  // Doesn't apply: unsubscription happens controlled by the consumer
  it.skip("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
  })

  // Doesn't apply: unsubscription happens controlled by the consumer
  it("it never closes the last subscription when the grace-period is Infinity", async () => {
  })

  it("suspends the component when the observable emits SUSPENSE", async () => {
    const subject$ = new Subject()
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
    const [, delayedNumber$] = bind(source$)
    const sub = createSubscription(delayedNumber$);
    const Result: React.FC = () => <div>Result {useSubscription(sub)}</div>
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
      scan((a) => a + 1, 0),
      map((x) => {
        if (x <= 2) {
          return SUSPENSE
        }
        return x
      }),
      startWith(0),
    )
    const [, delayedNumber$] = bind(source$)
    const sub = createSubscription(delayedNumber$);
    const Result: React.FC = () => <div>Result {useSubscription(sub)}</div>
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
    const [, error$] = bind(errStream)
    const sub = createSubscription(error$);

    const ErrorComponent = () => {
      const value = useSubscription(sub)
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
    const errStream = new Observable((observer) =>
      observer.error("controlled error"),
    )
    const [, error$] = bind(errStream)
    const sub = createSubscription(error$);

    const ErrorComponent = () => {
      const value = useSubscription(sub)
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
    const [, error$] = bind(errStream)
    const sub = createSubscription(error$);

    const ErrorComponent = () => {
      const value = useSubscription(sub)
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

  // Doesn't apply: unsubscription happens controlled by the consumer
  it.skip("allows to retry the errored observable after a grace period of time", async () => {
  })

  it("doesn't throw errors on components that will get unmounted on the next cycle", () => {
    const valueStream = new BehaviorSubject(1)
    const [,value$] = bind(valueStream)
    const [, error$] = bind(
      value$.pipe(switchMap((v) => (v === 1 ? of(v) : throwError("error")))),
    )
    const valueSub = createSubscription(value$);
    const errorSub = createSubscription(error$);

    const ErrorComponent: FC = () => {
      const value = useSubscription(errorSub)

      return <>{value}</>
    }

    const Container: FC = () => {
      const value = useSubscription(valueSub)

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

  // Doesn't apply: sideEffects happen because of creating subscription in the first place
  it.skip("handles combined Suspended components that resolve at different times", async () => {
    let nSideEffects = 0
    const fast$ = defer(() => {
      nSideEffects++
      return of("fast")
    }).pipe(delay(5))
    const slow$ = defer(() => {
      nSideEffects++
      return of("slow")
    }).pipe(delay(2500))

    const [, fastB$] = bind(concat(of(SUSPENSE), fast$))
    const [, slowB$] = bind(concat(of(SUSPENSE), slow$))
    const fastSub = createSubscription(fastB$);
    const slowSub = createSubscription(slowB$);

    const Fast: React.FC = () => <>{useSubscription(fastSub)}</>
    const Slow: React.FC = () => <>{useSubscription(slowSub)}</>

    expect(nSideEffects).toBe(0)

    render(
      <Suspense fallback={<div>Loading...</div>}>
        <Slow />
        <Fast />
      </Suspense>,
    )

    expect(screen.queryByText("Loading...")).not.toBeNull()

    expect(nSideEffects).toBe(2)

    await componentAct(async () => {
      await wait(2600)
    })

    expect(screen.queryByText("Loading...")).toBeNull()
    expect(nSideEffects).toBe(2)
  })
})

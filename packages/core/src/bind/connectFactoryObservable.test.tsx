import {
  act as componentAct,
  fireEvent,
  render,
  screen,
} from "@testing-library/react"
import { act as actHook, renderHook } from "@testing-library/react-hooks"
import React, { FC, Suspense, useState } from "react"
import {
  BehaviorSubject,
  concat,
  defer,
  from,
  Observable,
  of,
  Subject,
  throwError,
} from "rxjs"
import {
  catchError,
  delay,
  map,
  startWith,
  switchMap,
  take,
} from "rxjs/operators"
import { bind } from "../"
import { TestErrorBoundary } from "../test-helpers/TestErrorBoundary"

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

describe("connectFactoryObservable", () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = (...args: any) => {
      if (
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
  describe("hook", () => {
    it("returns the latest emitted value", async () => {
      const valueStream = new BehaviorSubject(1)
      const [useNumber] = bind(() => valueStream)
      const { result } = renderHook(() => useNumber())
      expect(result.current).toBe(1)

      actHook(() => {
        valueStream.next(3)
      })
      expect(result.current).toBe(3)
    })

    it("accepts a changing number of arguments", async () => {
      const [useConcatNumber] = bind((...args: number[]) => of(args.join(",")))
      const { result, rerender } = renderHook(
        ({ args }) => useConcatNumber(...args),
        {
          initialProps: {
            args: [1],
          },
        },
      )
      expect(result.current).toBe("1")

      rerender({ args: [1, 2] })
      expect(result.current).toBe("1,2")
    })

    it("suspends the component when the observable hasn't emitted yet.", async () => {
      const source$ = of(1).pipe(delay(100))
      const [useDelayedNumber, getDelayedNumber$] = bind(() => source$)
      const subs = getDelayedNumber$().subscribe()
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
      subs.unsubscribe()
    })

    it("shares the multicasted subscription with all of the components that use the same parameters", async () => {
      let subscriberCount = 0
      const observable$ = defer(() => {
        subscriberCount += 1
        return from([1, 2, 3, 4, 5])
      })

      const [
        useLatestNumber,
        latestNumber$,
      ] = bind((id: number, value: { val: number }) =>
        concat(observable$, of(id + value.val)),
      )
      expect(subscriberCount).toBe(0)

      const first = { val: 1 }
      latestNumber$(1, first).subscribe()
      renderHook(() => useLatestNumber(1, first))
      expect(subscriberCount).toBe(1)

      renderHook(() => useLatestNumber(1, first))
      expect(subscriberCount).toBe(1)

      expect(subscriberCount).toBe(1)

      const second = { val: 2 }
      latestNumber$(1, second).subscribe()
      renderHook(() => useLatestNumber(1, second))
      expect(subscriberCount).toBe(2)

      latestNumber$(2, second).subscribe()
      renderHook(() => useLatestNumber(2, second))
      expect(subscriberCount).toBe(3)
    })

    it("returns the value of next new Observable when the arguments change", () => {
      const [useNumber] = bind((x: number) => of(x))
      const { result, rerender } = renderHook(({ input }) => useNumber(input), {
        initialProps: { input: 0 },
      })
      expect(result.current).toBe(0)

      actHook(() => {
        rerender({ input: 1 })
      })
      expect(result.current).toBe(1)

      actHook(() => {
        rerender({ input: 2 })
      })
      expect(result.current).toBe(2)
    })

    it("handles optional args correctly", () => {
      const [, getNumber$] = bind((x: number, y?: number) => of(x + (y ?? 0)))

      expect(getNumber$(5)).toBe(getNumber$(5, undefined))
      expect(getNumber$(6, undefined)).toBe(getNumber$(6))
    })

    it("suspends the component when the factory-observable hasn't emitted yet.", async () => {
      const [useDelayedNumber, getDelayedNumber$] = bind((x: number) =>
        of(x).pipe(delay(50)),
      )
      const Result: React.FC<{ input: number }> = (p) => (
        <div>Result {useDelayedNumber(p.input)}</div>
      )
      const TestSuspense: React.FC = () => {
        const [input, setInput] = useState(0)
        return (
          <>
            <Suspense fallback={<span>Waiting</span>}>
              <Result input={input} />
            </Suspense>
            <button onClick={() => setInput((x) => x + 1)}>increase</button>
          </>
        )
      }

      getDelayedNumber$(0).subscribe()
      render(<TestSuspense />)
      expect(screen.queryByText("Result")).toBeNull()
      expect(screen.queryByText("Waiting")).not.toBeNull()
      await componentAct(async () => {
        await wait(60)
      })
      expect(screen.queryByText("Result 0")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()

      componentAct(() => {
        getDelayedNumber$(1).subscribe()
        fireEvent.click(screen.getByText(/increase/i))
      })
      expect(screen.queryByText("Result")).toBeNull()
      expect(screen.queryByText("Waiting")).not.toBeNull()
      await componentAct(async () => {
        await wait(60)
      })
      expect(screen.queryByText("Result 1")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()

      componentAct(() => {
        getDelayedNumber$(2).subscribe()
        fireEvent.click(screen.getByText(/increase/i))
      })
      expect(screen.queryByText("Result")).toBeNull()
      expect(screen.queryByText("Waiting")).not.toBeNull()
      await componentAct(async () => {
        await wait(60)
      })
      expect(screen.queryByText("Result 2")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()
    })

    it("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
      let nInitCount = 0
      const observable$ = defer(() => {
        nInitCount += 1
        return from([1, 2, 3, 4, 5])
      })

      const [useLatestNumber, getLatestNumber$] = bind((id: number) =>
        concat(observable$, of(id)),
      )
      let subs = getLatestNumber$(6).subscribe()
      const { unmount } = renderHook(() => useLatestNumber(6))
      const { unmount: unmount2 } = renderHook(() => useLatestNumber(6))
      const { unmount: unmount3 } = renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(1)
      unmount()
      unmount2()
      unmount3()

      const { unmount: unmount4 } = renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(1)

      unmount4()
      subs.unsubscribe()

      getLatestNumber$(6).subscribe()
      renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(2)
    })

    it("allows errors to be caught in error boundaries", () => {
      const errStream = new BehaviorSubject(1)
      const [useError] = bind(() => errStream)

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
      const errStream = new Observable((observer) =>
        observer.error("controlled error"),
      )
      const [useError] = bind((_: string) => errStream)

      const ErrorComponent = () => {
        const value = useError("foo")

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
      const [useError] = bind((_: string) => errStream)

      const ErrorComponent = () => {
        const value = useError("foo")

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
        await wait(10)
      })

      expect(errorCallback).toHaveBeenCalledWith(
        "controlled error",
        expect.any(Object),
      )
      unmount()
    })

    it(
      "the errror-boundary can capture errors that are produced when changing the " +
        "key of the hook to an observable that throws synchronously",
      async () => {
        const normal$ = new Subject<string>()
        const errored$ = new Observable<string>((observer) => {
          observer.error("controlled error")
        })

        const [useOkKo, getObs$] = bind((ok: boolean) =>
          ok ? normal$ : errored$,
        )
        getObs$(true).subscribe()
        getObs$(false)
          .pipe(catchError(() => []))
          .subscribe()

        const ErrorComponent = () => {
          const [ok, setOk] = useState(true)
          const value = useOkKo(ok)

          return <span onClick={() => setOk(false)}>{value}</span>
        }

        const errorCallback = jest.fn()
        const { unmount } = render(
          <TestErrorBoundary onError={errorCallback}>
            <Suspense fallback={<div>Loading...</div>}>
              <ErrorComponent />
            </Suspense>
          </TestErrorBoundary>,
        )

        expect(screen.queryByText("ALL GOOD")).toBeNull()
        expect(screen.queryByText("Loading...")).not.toBeNull()

        await componentAct(async () => {
          normal$.next("ALL GOOD")
          await wait(50)
        })

        expect(screen.queryByText("ALL GOOD")).not.toBeNull()
        expect(screen.queryByText("Loading...")).toBeNull()
        expect(errorCallback).not.toHaveBeenCalled()

        componentAct(() => {
          fireEvent.click(screen.getByText(/GOOD/i))
        })

        expect(errorCallback).toHaveBeenCalledWith(
          "controlled error",
          expect.any(Object),
        )

        unmount()
      },
    )

    it("doesn't throw errors on components that will get unmounted on the next cycle", () => {
      const valueStream = new BehaviorSubject(1)
      const [useValue, value$] = bind(() => valueStream)
      const [useError] = bind(() =>
        value$().pipe(
          switchMap((v) => (v === 1 ? of(v) : throwError("error"))),
        ),
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

    it("does not resubscribe to an observable that emits synchronously and that does not have a top-level subscription after a re-render", () => {
      let nTopSubscriptions = 0

      const [useNTopSubscriptions] = bind((id: number) =>
        defer(() => {
          return of(++nTopSubscriptions + id)
        }),
      )

      const { result, rerender, unmount } = renderHook(() =>
        useNTopSubscriptions(0),
      )

      expect(result.current).toBe(2)

      actHook(() => {
        rerender()
      })
      expect(result.current).toBe(2)
      expect(nTopSubscriptions).toBe(2)

      unmount()
    })

    it("supports streams that emit functions", () => {
      const values$ = new Subject<number>()

      const [useFunction, function$] = bind(() =>
        values$.pipe(
          startWith(0),
          map((value) => () => value),
        ),
      )
      const subscription = function$().subscribe()

      const { result } = renderHook(() => useFunction())

      expect(result.current()).toBe(0)

      values$.next(1)
      expect(result.current()).toBe(1)

      subscription.unsubscribe()
    })

    it("if the observable hasn't emitted and a defaultValue is provided, it does not start suspense", () => {
      const number$ = new Subject<number>()
      const [useNumber] = bind(
        (id: number) => number$.pipe(map((x) => x + id)),
        0,
      )

      const { result, unmount } = renderHook(() => useNumber(5))

      expect(result.current).toBe(0)

      actHook(() => {
        number$.next(5)
      })

      expect(result.current).toBe(10)

      unmount()
    })

    it("when a defaultValue is provided, the first subscription happens once the component is mounted", () => {
      let nTopSubscriptions = 0

      const [useNTopSubscriptions] = bind(
        (id: number) =>
          defer(() => {
            return of(++nTopSubscriptions + id)
          }),
        1,
      )

      const { result, rerender, unmount } = renderHook(() =>
        useNTopSubscriptions(0),
      )

      expect(result.current).toBe(1)

      actHook(() => {
        rerender()
      })

      expect(result.current).toBe(1)
      expect(nTopSubscriptions).toBe(1)

      unmount()
    })
  })

  describe("observable", () => {
    it("it does not complete when the source observable completes", async () => {
      let diff = -1
      const [useLatestNumber, getShared] = bind((_: number) => {
        diff++
        return from([1, 2, 3, 4].map((val) => val + diff))
      })

      let latestValue1: number = 0
      let nUpdates = 0
      const sub1 = getShared(0).subscribe((x) => {
        latestValue1 = x
        nUpdates += 1
      })
      expect(latestValue1).toBe(4)
      expect(nUpdates).toBe(4)
      expect(sub1.closed).toBe(false)
      sub1.unsubscribe()

      let sub = getShared(0).subscribe()
      const { result, unmount } = renderHook(() => useLatestNumber(0))
      expect(result.current).toBe(5)
      expect(nUpdates).toBe(4)

      let latestValue2: number = 0
      const sub2 = getShared(0).subscribe((x) => {
        latestValue2 = x
        nUpdates += 1
      })
      expect(latestValue2).toBe(5)
      expect(nUpdates).toBe(5)
      expect(sub2.closed).toBe(false)
      sub2.unsubscribe()

      let latestValue3: number = 0
      const sub3 = getShared(0).subscribe((x) => {
        latestValue3 = x
        nUpdates += 1
      })
      expect(latestValue3).toBe(5)
      expect(nUpdates).toBe(6)
      expect(sub3.closed).toBe(false)
      sub3.unsubscribe()

      unmount()
      sub.unsubscribe()

      let latestValue4: number = 0
      const sub4 = getShared(0).subscribe((x) => {
        latestValue4 = x
        nUpdates += 1
      })
      expect(latestValue4).toBe(6)
      expect(nUpdates).toBe(10)
      expect(sub4.closed).toBe(false)
      sub4.unsubscribe()
    })

    describe("re-subscriptions on disposed observables", () => {
      it("registers itself when no other observable has been registered for that key", () => {
        const key = 0
        let sideEffects = 0

        const [, getShared] = bind((_: number) =>
          defer(() => {
            return of(++sideEffects)
          }),
        )

        const stream = getShared(key)

        let val
        stream.pipe(take(1)).subscribe((x) => {
          val = x
        })
        expect(val).toBe(1)

        stream.pipe(take(1)).subscribe((x) => {
          val = x
        })
        expect(val).toBe(2)

        const subscription = stream.subscribe((x) => {
          val = x
        })
        expect(val).toBe(3)

        getShared(key)
          .pipe(take(1))
          .subscribe((x) => {
            val = x
          })
        expect(val).toBe(3)
        subscription.unsubscribe()
      })

      it("subscribes to the currently registered observable if a new observalbe has been registered for that key", () => {
        const key = 0
        let sideEffects = 0

        const [, getShared] = bind((_: number) =>
          defer(() => {
            return of(++sideEffects)
          }),
        )

        const stream = getShared(key)

        let val
        stream.pipe(take(1)).subscribe((x) => {
          val = x
        })
        expect(val).toBe(1)

        const subscription = getShared(key).subscribe((x) => {
          val = x
        })
        expect(val).toBe(2)

        stream.pipe(take(1)).subscribe((x) => {
          val = x
        })
        expect(val).toBe(2)

        stream.pipe(take(1)).subscribe((x) => {
          val = x
        })
        expect(val).toBe(2)

        subscription.unsubscribe()
      })
    })
  })
})

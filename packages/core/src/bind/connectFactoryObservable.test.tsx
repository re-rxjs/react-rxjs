import {
  from,
  of,
  defer,
  concat,
  throwError,
  Observable,
  Subject,
  merge,
  EMPTY,
  NEVER,
  noop,
} from "rxjs"
import { renderHook, act as actHook } from "@testing-library/react-hooks"
import {
  delay,
  take,
  catchError,
  map,
  switchMapTo,
  first,
  startWith,
} from "rxjs/operators"
import { FC, useState } from "react"
import React from "react"
import {
  act as componentAct,
  fireEvent,
  screen,
  render,
  act,
  waitFor,
} from "@testing-library/react"
import { bind, Subscribe } from "../"
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
      const valueStream = new Subject<number>()
      const [useNumber] = bind(() => valueStream, 1)
      const { result } = renderHook(() => useNumber())
      expect(result.current).toBe(1)

      actHook(() => {
        valueStream.next(3)
      })
      expect(result.current).toBe(3)
    })

    it("suspends the component when the observable hasn't emitted yet.", async () => {
      const source$ = of(1).pipe(delay(100))
      const [useDelayedNumber] = bind(() => source$)
      const Result: React.FC = () => <div>Result {useDelayedNumber()}</div>
      const TestSuspense: React.FC = () => {
        return (
          <Subscribe fallback={<span>Waiting</span>}>
            <Result />
          </Subscribe>
        )
      }

      render(<TestSuspense />)

      expect(screen.queryByText("Result")).toBeNull()
      expect(screen.queryByText("Waiting")).not.toBeNull()

      await wait(110)

      expect(screen.queryByText("Result 1")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()
    })

    it("synchronously mounts the emitted value if the observable emits synchronously", () => {
      const source$ = of(1)
      const [useDelayedNumber] = bind(() => source$)
      const Result: React.FC = () => <div>Result {useDelayedNumber()}</div>
      const TestSuspense: React.FC = () => {
        return (
          <Subscribe fallback={<span>Waiting</span>}>
            <Result />
          </Subscribe>
        )
      }

      render(<TestSuspense />)

      expect(screen.queryByText("Result 1")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()
    })

    it("doesn't mount the fallback element if the subscription is already active", () => {
      const source$ = new Subject<number>()
      const [useDelayedNumber, getDelayedNumber$] = bind(() => source$)
      const Result: React.FC = () => <div>Result {useDelayedNumber()}</div>
      const TestSuspense: React.FC = () => {
        return (
          <Subscribe fallback={<span>Waiting</span>}>
            <Result />
          </Subscribe>
        )
      }

      const subscription = getDelayedNumber$().subscribe()
      source$.next(1)
      render(<TestSuspense />)

      expect(screen.queryByText("Result 1")).not.toBeNull()
      expect(screen.queryByText("Waiting")).toBeNull()
      subscription.unsubscribe()
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
      const [useNumber, getNumber$] = bind((x: number) => of(x))
      const subs = merge(
        getNumber$(0),
        getNumber$(1),
        getNumber$(2),
      ).subscribe()
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
      subs.unsubscribe()
    })

    it("immediately switches the state to the new observable", () => {
      const [useNumber, getNumber$] = bind((x: number) => of(x))
      merge(getNumber$(0), getNumber$(1), getNumber$(2)).subscribe()

      const Form = ({ id }: { id: number }) => {
        const value = useNumber(id)

        return <input role="input" key={id} defaultValue={value} />
      }

      const { rerender, getByRole } = render(<Form id={0} />)
      expect((getByRole("input") as HTMLInputElement).value).toBe("0")

      act(() => rerender(<Form id={1} />))
      expect((getByRole("input") as HTMLInputElement).value).toBe("1")

      act(() => rerender(<Form id={2} />))
      expect((getByRole("input") as HTMLInputElement).value).toBe("2")
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
            <Subscribe fallback={<span>Waiting</span>}>
              <Result input={input} />
            </Subscribe>
            <button onClick={() => setInput((x) => x + 1)}>increase</button>
          </>
        )
      }

      getDelayedNumber$(0).subscribe()
      render(<TestSuspense />)
      expect(screen.queryByText("Result")).toBeNull()
      expect(screen.queryByText("Waiting")).not.toBeNull()
      await componentAct(async () => {
        await getDelayedNumber$(0).pipe(first()).toPromise()
        await wait(0)
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
      const errStream = new Subject()
      const [useError] = bind(() => errStream, 1)

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
          <Subscribe fallback={<div>Loading...</div>}>
            <ErrorComponent />
          </Subscribe>
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

        const Ok: React.FC<{ ok: boolean }> = ({ ok }) => <>{useOkKo(ok)}</>

        const ErrorComponent = () => {
          const [ok, setOk] = useState(true)

          return (
            <Subscribe fallback={<div>Loading...</div>}>
              <span onClick={() => setOk(false)}>
                <Ok ok={ok} />
              </span>
            </Subscribe>
          )
        }

        const errorCallback = jest.fn()
        const { unmount } = render(
          <TestErrorBoundary onError={errorCallback}>
            <ErrorComponent />
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
      const valueStream = new Subject<number>()
      const [useValue] = bind(() => valueStream, 1)
      const [useError] = bind(
        () => valueStream.pipe(switchMapTo(throwError("error"))),
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

      const errorCallback = jest.fn()
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

      const [useFunction, function$] = bind(() =>
        values$.pipe(
          startWith(0),
          map((value) => () => value),
        ),
      )
      const subscription = function$().subscribe()

      const { result } = renderHook(() => useFunction())

      expect(result.current()).toBe(0)

      actHook(() => {
        values$.next(1)
      })

      expect(result.current()).toBe(1)

      subscription.unsubscribe()
    })

    it("the defaultValue can be undefined", () => {
      const number$ = new Subject<number>()
      const [useNumber] = bind(() => number$, undefined)

      const { result, unmount } = renderHook(() => useNumber())

      expect(result.current).toBe(undefined)

      actHook(() => {
        number$.next(5)
      })

      expect(result.current).toBe(5)

      unmount()
    })

    it("the defaultValue can be a function that receives the keys", () => {
      const subj$ = new Subject<number>()
      const [useNumber, number$] = bind(
        (_: number) => subj$,
        (key) => key,
      )

      const { result, unmount } = renderHook(() => useNumber(10))

      expect(result.current).toBe(10)
      let res = 0
      number$(10)
        .subscribe((x) => {
          res = x
        })
        .unsubscribe()
      expect(res).toBe(10)

      actHook(() => {
        subj$.next(5)
      })

      expect(result.current).toBe(5)

      unmount()
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

  it("when a defaultValue is provided, the resulting observable should emmit the defaultValue first if the source doesn't synchronously emmit anything", () => {
    let value = 0
    let [, result$] = bind<[], number>(() => NEVER, 10)
    result$().subscribe((v) => {
      value = v
    })
    expect(value).toBe(10)

    value = 0
    ;[, result$] = bind(() => EMPTY, 10)
    result$().subscribe((v) => {
      value = v
    })
    expect(value).toBe(10)

    value = 0
    ;[, result$] = bind(() => of(5), 10)
    result$().subscribe((v) => {
      value += v
    })
    expect(value).toBe(5)
  })

  it("ensures that components subscriptions are being taken into account", async () => {
    const ticks$ = new Subject<void>()
    const [useValue] = bind((_: string) => ticks$.pipe(map((_, idx) => idx)))
    const update$ = new Subject<void>()

    const key = "foo"

    const Result: React.FC = () => <div>Result {useValue(key)}</div>
    const Container: React.FC = () => {
      return (
        <>
          <Subscribe fallback={<span>Waiting</span>}>
            <Result />
          </Subscribe>
          <button onClick={() => update$.next()}>Next</button>
        </>
      )
    }

    render(<Container />)

    expect(screen.queryByText("Waiting")).not.toBeNull()
    componentAct(() => {
      ticks$.next()
    })

    await waitFor(() => expect(screen.queryByText("Waiting")).toBeNull())
    expect(screen.getByText("Result 0")).not.toBeNull()

    componentAct(() => {
      ticks$.next()
    })

    await waitFor(() => expect(screen.getByText("Result 1")).not.toBeNull())

    componentAct(() => {
      ticks$.next()
    })

    await waitFor(() => expect(screen.getByText("Result 2")).not.toBeNull())

    componentAct(() => {
      fireEvent.click(screen.getByText(/Next/i))
    })

    expect(screen.getByText("Result 2")).not.toBeNull()

    componentAct(() => {
      ticks$.next()
    })

    await waitFor(() => expect(screen.getByText("Result 3")).not.toBeNull())
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

      it("does not crash when the observable lazily references its enhanced self", () => {
        const [, obs$] = bind(
          (key: number) => defer(() => obs$(key)).pipe(take(1)),
          (key) => key,
        )

        let error = null
        obs$(1)
          .subscribe(noop, (e: any) => {
            error = e
          })
          .unsubscribe()

        expect(error).toBeNull()
      })

      it("does not crash when the factory function self-references its enhanced self", () => {
        let nSubscriptions = 0
        const [, me$] = bind(
          (key: number): Observable<number> => {
            nSubscriptions++
            return me$(key).pipe(
              take(1),
              map((x) => x * 2),
            )
          },
          (key: number) => key,
        )

        let value = 0
        const sub1 = me$(5).subscribe((val) => {
          value = val
        })

        expect(value).toBe(10)
        expect(sub1.closed).toBe(false)

        value = 0
        const sub2 = me$(5).subscribe((val) => {
          value = val
        })

        expect(value).toBe(10)
        expect(nSubscriptions).toBe(1)

        sub1.unsubscribe()
        sub2.unsubscribe()

        const sub3 = me$(5).subscribe((val) => {
          value = val
        })

        expect(value).toBe(10)
        expect(nSubscriptions).toBe(2)
        sub3.unsubscribe()
      })
    })
  })
})

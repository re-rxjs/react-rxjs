import { connectFactoryObservable } from "../src"
import { from, of, defer, concat, BehaviorSubject, throwError } from "rxjs"
import { renderHook, act as actHook } from "@testing-library/react-hooks"
import { render, act } from "@testing-library/react"
import { switchMap } from "rxjs/operators"
import { Component, ErrorInfo, FC } from "react"
import React from "react"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

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
      const [useNumber] = connectFactoryObservable(() => valueStream)
      const { result } = renderHook(() => useNumber())
      expect(result.current).toBe(1)

      actHook(() => {
        valueStream.next(3)
      })
      expect(result.current).toBe(3)
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
      ] = connectFactoryObservable((id: number, value: number) =>
        concat(observable$, of(id + value)),
      )
      expect(subscriberCount).toBe(0)

      renderHook(() => useLatestNumber(1, 1))
      expect(subscriberCount).toBe(1)

      renderHook(() => useLatestNumber(1, 1))
      expect(subscriberCount).toBe(1)

      latestNumber$(1, 1).subscribe()
      expect(subscriberCount).toBe(1)

      renderHook(() => useLatestNumber(1, 2))
      expect(subscriberCount).toBe(2)

      renderHook(() => useLatestNumber(2, 2))
      expect(subscriberCount).toBe(3)
    })

    it("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
      let nInitCount = 0
      const observable$ = defer(() => {
        nInitCount += 1
        return from([1, 2, 3, 4, 5])
      })

      const [useLatestNumber] = connectFactoryObservable(
        (id: number) => concat(observable$, of(id)),
        100,
      )
      const { unmount } = renderHook(() => useLatestNumber(6))
      const { unmount: unmount2 } = renderHook(() => useLatestNumber(6))
      const { unmount: unmount3 } = renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(1)
      unmount()
      unmount2()
      unmount3()

      await wait(90)
      const { unmount: unmount4 } = renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(1)
      unmount4()

      await wait(110)
      renderHook(() => useLatestNumber(6))
      expect(nInitCount).toBe(2)
    })

    it("allows errors to be caught in error boundaries", () => {
      const errStream = new BehaviorSubject(1)
      const [useError] = connectFactoryObservable(() => errStream)

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

      act(() => {
        errStream.error("controlled error")
      })

      expect(errorCallback).toHaveBeenCalledWith(
        "controlled error",
        expect.any(Object),
      )
    })

    it("doesn't throw errors on components that will get unmounted on the next cycle", () => {
      const valueStream = new BehaviorSubject(1)
      const [useValue, value$] = connectFactoryObservable(() => valueStream)
      const [useError] = connectFactoryObservable(() =>
        value$().pipe(switchMap(v => (v === 1 ? of(v) : throwError("error")))),
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

      act(() => {
        valueStream.next(2)
      })

      expect(errorCallback).not.toHaveBeenCalled()
    })
  })
  describe("observable", () => {
    it("returns a factory of BehaviorObservables", () => {
      const [, getShared] = connectFactoryObservable((x: number) => of(x))
      expect((getShared(0) as any).getValue).toBeInstanceOf(Function)
    })

    it("if the source observable completes it keeps emitting the latest value until there are no more subscriptions", () => {
      let diff = -1
      const [, getShared] = connectFactoryObservable((_: number) => {
        diff++
        return from([1, 2, 3, 4].map(val => val + diff))
      })

      let latestValue1: number = 0
      let nUpdates = 0
      const sub1 = getShared(0).subscribe(x => {
        latestValue1 = x
        nUpdates += 1
      })
      expect(latestValue1).toBe(4)
      expect(nUpdates).toBe(4)

      let latestValue2: number = 0
      const sub2 = getShared(0).subscribe(x => {
        latestValue2 = x
        nUpdates += 1
      })
      expect(latestValue2).toBe(4)
      expect(nUpdates).toBe(5)

      sub1.unsubscribe()
      sub2.unsubscribe()

      let latestValue3: number = 0
      const sub3 = getShared(0).subscribe(x => {
        latestValue3 = x
        nUpdates += 1
      })
      expect(latestValue3).toBe(5)
      expect(nUpdates).toBe(9)
      sub3.unsubscribe()
    })
  })
})

class TestErrorBoundary extends Component<
  {
    onError: (error: Error, errorInfo: ErrorInfo) => void
  },
  {
    hasError: boolean
  }
> {
  state = {
    hasError: false,
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError(error, errorInfo)
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return "error"
    }

    return this.props.children
  }
}

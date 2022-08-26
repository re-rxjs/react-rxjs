import { sinkSuspense, state, SUSPENSE } from "@rx-state/core"
import { act, render, screen } from "@testing-library/react"
import React, { StrictMode, useEffect, useState } from "react"
import { defer, EMPTY, NEVER, Observable, of, startWith, Subject } from "rxjs"
import { bind, RemoveSubscribe, Subscribe as OriginalSubscribe } from "./"
import { TestErrorBoundary } from "./test-helpers/TestErrorBoundary"
import { useStateObservable } from "./useStateObservable"

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

const Subscribe = (props: any) => {
  return (
    <StrictMode>
      <OriginalSubscribe {...props} />
    </StrictMode>
  )
}

describe("Subscribe", () => {
  describe("Subscribe with source$", () => {
    it("renders the sync emitted value on a StateObservable without default value", () => {
      const test$ = state(EMPTY.pipe(startWith("there!")))
      const useTest = () => useStateObservable(test$)

      const Test: React.FC = () => <>Hello {useTest()}</>

      const TestSubscribe: React.FC = () => (
        <Subscribe>
          <Test />
        </Subscribe>
      )

      const { unmount } = render(<TestSubscribe />)

      expect(screen.queryByText("Hello there!")).not.toBeNull()

      unmount()
    })
    it("subscribes to the provided observable and remains subscribed until it's unmounted", () => {
      let nSubscriptions = 0
      const [useNumber, number$] = bind(
        new Observable<number>(() => {
          nSubscriptions++
          return () => {
            nSubscriptions--
          }
        }),
      )

      const Number: React.FC = () => <>{useNumber()}</>
      const TestSubscribe: React.FC = () => (
        <Subscribe source$={number$} fallback={null}>
          <Number />
        </Subscribe>
      )

      expect(nSubscriptions).toBe(0)

      const { unmount } = render(<TestSubscribe />)

      expect(nSubscriptions).toBe(1)

      unmount()
      expect(nSubscriptions).toBe(0)
    })

    it("doesn't render its content until it has subscribed to a new source", () => {
      let nSubscriptions = 0
      let errored = false
      const [useInstance, instance$] = bind((id: number) => {
        if (id === 0) {
          return of(0)
        }
        return defer(() => {
          nSubscriptions++
          return of(1)
        })
      })

      const Child = ({ id }: { id: number }) => {
        const value = useInstance(id)

        if (id !== 0 && nSubscriptions === 0) {
          errored = true
        }

        return <>{value}</>
      }
      const { rerender } = render(
        <Subscribe source$={instance$(0)}>
          <Child id={0} />
        </Subscribe>,
      )
      expect(nSubscriptions).toBe(0)
      expect(errored).toBe(false)

      rerender(
        <Subscribe source$={instance$(1)}>
          <Child id={1} />
        </Subscribe>,
      )
      expect(nSubscriptions).toBe(1)
      expect(errored).toBe(false)

      rerender(
        <Subscribe>
          <Child id={2} />
        </Subscribe>,
      )
      expect(nSubscriptions).toBe(2)
      expect(errored).toBe(false)
    })

    it("prevents the issue of stale data when switching keys", () => {
      const [useInstance, instance$] = bind((id: number) => of(id))

      const Child = ({
        id,
        initialValue,
      }: {
        id: number
        initialValue: number
      }) => {
        const [value] = useState(initialValue)

        return (
          <>
            <div data-testid="id">{id}</div>
            <div data-testid="value">{value}</div>
          </>
        )
      }

      const Parent = ({ id }: { id: number }) => {
        const value = useInstance(id)

        return <Child key={id} id={id} initialValue={value} />
      }
      const { rerender, getByTestId } = render(
        <Subscribe source$={instance$(0)}>
          <Parent id={0} />
        </Subscribe>,
      )

      rerender(
        <Subscribe source$={instance$(1)}>
          <Parent id={1} />
        </Subscribe>,
      )
      expect(getByTestId("id").textContent).toBe("1")
      expect(getByTestId("value").textContent).toBe("1")

      const instanceTwoSubs = instance$(2).subscribe()
      rerender(
        <Subscribe source$={instance$(2)}>
          <Parent id={2} />
        </Subscribe>,
      )
      expect(getByTestId("id").textContent).toBe("2")
      expect(getByTestId("value").textContent).toBe("2")
      instanceTwoSubs.unsubscribe()
    })

    it("lifts the effects of the source$ prop", () => {
      const subject$ = new Subject<number | SUSPENSE>()
      const test$ = state(subject$.pipe(sinkSuspense()))

      const { unmount } = render(<Subscribe source$={test$} />)

      expect(test$.getRefCount()).toBe(1)

      act(() => subject$.next(SUSPENSE))
      expect(test$.getRefCount()).toBe(1)

      act(() => subject$.next(1))
      expect(test$.getRefCount()).toBe(1)

      unmount()
    })
  })
  describe("Subscribe without source$", () => {
    it("subscribes to the provided observable and remains subscribed until it's unmounted", () => {
      let nSubscriptions = 0
      const [useNumber] = bind(
        new Observable<number>(() => {
          nSubscriptions++
          return () => {
            nSubscriptions--
          }
        }),
      )

      const Number: React.FC = () => <>{useNumber()}</>
      const TestSubscribe: React.FC = () => (
        <Subscribe fallback={null}>
          <Number />
        </Subscribe>
      )

      expect(nSubscriptions).toBe(0)

      const { unmount } = render(<TestSubscribe />)

      expect(nSubscriptions).toBe(1)

      unmount()
      expect(nSubscriptions).toBe(0)
    })

    it("doesn't render its content until it has subscribed to a new source", () => {
      let nSubscriptions = 0
      let errored = false
      const [useInstance] = bind((id: number) => {
        if (id === 0) {
          return of(0)
        }
        return defer(() => {
          nSubscriptions++
          return of(1)
        })
      })

      const Child = ({ id }: { id: number }) => {
        const value = useInstance(id)

        if (id !== 0 && nSubscriptions === 0) {
          errored = true
        }

        return <>{value}</>
      }
      const { rerender } = render(
        <Subscribe>
          <Child id={0} />
        </Subscribe>,
      )
      expect(nSubscriptions).toBe(0)
      expect(errored).toBe(false)

      rerender(
        <Subscribe>
          <Child id={1} />
        </Subscribe>,
      )
      expect(nSubscriptions).toBe(1)
      expect(errored).toBe(false)
    })

    it("prevents the issue of stale data when switching keys", () => {
      const [useInstance] = bind((id: number) => of(id))

      const Child = ({
        id,
        initialValue,
      }: {
        id: number
        initialValue: number
      }) => {
        const [value] = useState(initialValue)

        return (
          <>
            <div data-testid="id">{id}</div>
            <div data-testid="value">{value}</div>
          </>
        )
      }

      const Parent = ({ id }: { id: number }) => {
        const value = useInstance(id)

        return <Child key={id} id={id} initialValue={value} />
      }
      const { rerender, getByTestId } = render(
        <Subscribe>
          <Parent id={0} />
        </Subscribe>,
      )

      rerender(
        <Subscribe>
          <Parent id={1} />
        </Subscribe>,
      )
      expect(getByTestId("id").textContent).toBe("1")
      expect(getByTestId("value").textContent).toBe("1")
    })

    it("on StrictMode: it doesn't crash if the component immediately unmounts", () => {
      function App() {
        const [switched, setSwitched] = useState(false)

        useEffect(() => {
          setSwitched(true)
        }, [])

        return (
          <div className="App">
            {switched ? <SwitchToComponent /> : <ProblematicComponent />}
          </div>
        )
      }

      const ProblematicComponent = () => {
        return <Subscribe></Subscribe>
      }
      const SwitchToComponent = () => {
        return <div>All good</div>
      }

      let hasError = false

      render(
        <TestErrorBoundary
          onError={() => {
            hasError = true
          }}
        >
          <App />
        </TestErrorBoundary>,
      )

      expect(hasError).toBe(false)
    })

    it("allows async errors to be caught in error boundaries with suspense, without using source$", async () => {
      const [useError] = bind(
        new Observable((obs) => {
          setTimeout(() => obs.error("controlled error"), 10)
        }),
      )

      const ErrorComponent = () => {
        const value = useError()
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

      await act(async () => {
        await wait(100)
      })

      expect(errorCallback).toHaveBeenCalledWith(
        "controlled error",
        expect.any(Object),
      )
      unmount()
    })

    it("lifts the effects of observables passed through context", () => {
      const subject$ = new Subject<number | SUSPENSE>()
      let innerSubs = 0
      const test$ = state(
        defer(() => {
          innerSubs++
          return subject$
        }).pipe(sinkSuspense()),
      )

      const Child = () => <>{useStateObservable(test$)}</>

      const { unmount } = render(
        <Subscribe>
          <Child />
        </Subscribe>,
      )

      expect(test$.getRefCount()).toBe(1)

      act(() => subject$.next(SUSPENSE))
      expect(test$.getRefCount()).toBe(1)

      act(() => subject$.next(1))
      expect(test$.getRefCount()).toBe(1)

      expect(innerSubs).toBe(1)

      unmount()
    })
  })
})

describe("RemoveSubscribe", () => {
  it("prevents its children from using the parent Subscribe boundary", () => {
    const [useValue] = bind(NEVER)

    const ChildrenComponent = () => {
      const value = useValue()
      return <>{value}</>
    }

    const errorCallback = jest.fn()
    render(
      <TestErrorBoundary onError={(e) => errorCallback(e.message)}>
        <Subscribe>
          <RemoveSubscribe>
            <ChildrenComponent />
          </RemoveSubscribe>
        </Subscribe>
      </TestErrorBoundary>,
    )

    expect(errorCallback).toHaveBeenCalledWith("Missing Subscribe!")
  })
})

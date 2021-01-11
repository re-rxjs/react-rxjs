import { render } from "@testing-library/react"
import React, { useState } from "react"
import { defer, Observable, of } from "rxjs"
import { bind, Subscribe } from "./"

describe("Subscribe", () => {
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
      <Subscribe source$={number$}>
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
  })
})

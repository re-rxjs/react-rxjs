import React from "react"
import { render } from "@testing-library/react"
import { Observable } from "rxjs"
import { Subscribe, bind } from "./"

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
})

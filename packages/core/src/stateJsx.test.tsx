import { render, screen, act } from "@testing-library/react"
import React, { Suspense } from "react"
import { map, Subject } from "rxjs"
import { state } from "./"

describe("stateJsx", () => {
  it("is possible to use StateObservables as JSX elements", async () => {
    const subject = new Subject<string>()
    const state$ = state(subject)
    const subscription = state$.subscribe()

    render(<Suspense fallback="Waiting">{state$}</Suspense>)

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    await act(() => {
      subject.next("Result")
      return Promise.resolve()
    })

    expect(screen.queryByText("Result")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
    subscription.unsubscribe()
  })

  it("is possible to use factory StateObservables as JSX elements", async () => {
    const subject = new Subject<string>()
    const state$ = state((value: string) => subject.pipe(map((x) => value + x)))

    const subscription = state$("hello ").subscribe()

    render(<Suspense fallback="Waiting">{state$("hello ")}</Suspense>)

    expect(screen.queryByText("hello world!")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    await act(() => {
      subject.next("world!")
      return Promise.resolve()
    })

    expect(screen.queryByText("hello world!")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
    subscription.unsubscribe()
  })

  it("enhances the result of a pipeState to be used as a JSX element", async () => {
    const subject = new Subject<string>()
    const state$ = state(subject)

    const derivedState$ = state$.pipeState(map((v) => `derived ${v}`))
    const derivedTwiceState$ = derivedState$.pipeState(map((v) => `${v} again`))
    const subscription = derivedTwiceState$.subscribe()

    render(
      <Suspense fallback="Waiting">
        {derivedState$}, {derivedTwiceState$}
      </Suspense>,
    )

    expect(screen.queryByText("Waiting")).not.toBeNull()

    await act(() => {
      subject.next("Result")
      return Promise.resolve()
    })

    expect(
      screen.queryByText("derived Result, derived Result again"),
    ).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
    subscription.unsubscribe()
  })
})

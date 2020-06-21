import React, { useState, Suspense } from "react"
import { render, fireEvent, screen } from "@testing-library/react"
import { defer, of, Subject, NEVER, concat } from "rxjs"
import { renderHook, act } from "@testing-library/react-hooks"
import { useObservable } from "../src/useObservable"
import reactEnhancer from "../src/operators/react-enhancer"
import { SUSPENSE, BehaviorObservable, distinctShareReplay } from "../src"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

const enhancer = (source$: any) =>
  reactEnhancer(concat(source$, NEVER).pipe(distinctShareReplay()), 20)

describe("useObservable", () => {
  it("works", async () => {
    let counter = 0
    let subject = new Subject<number>()
    const source$ = defer(() => {
      subject = new Subject<number>()
      counter++
      return subject.asObservable()
    }).pipe(enhancer) as BehaviorObservable<number>

    const { result, unmount } = renderHook(() => useObservable(source$))

    expect(result.current).toBe(null)

    await act(async () => {
      subject.next(1)
      await wait(10)
    })
    expect(counter).toBe(1)
    expect(result.current).toEqual(1)

    act(() => {
      subject.next(4)
      subject.complete()
    })

    expect(result.current).toEqual(4)
    expect(counter).toBe(1)
    unmount()

    const secondMount = renderHook(() => useObservable(source$))

    expect(counter).toBe(1)
    expect(secondMount.result.current).toEqual(4)
    secondMount.unmount()

    await wait(40)

    const thirdMount = renderHook(() => useObservable(source$))

    expect(thirdMount.result.current).toEqual(null)
    expect(counter).toBe(2)

    await act(async () => {
      subject.next(1)
      await wait(10)
    })
    expect(thirdMount.result.current).toEqual(1)
    expect(counter).toBe(2)
  })

  const observables: any = [NEVER, of(10), of(SUSPENSE), of(20)].map(enhancer)
  const Result: React.FC<{ idx: number }> = ({ idx }) => {
    const result = useObservable(observables[idx % observables.length])
    return <div>Result {result}</div>
  }

  const TestSuspense: React.FC = () => {
    const [currentIdx, setCurrentIdx] = useState(0)

    return (
      <div>
        <button onClick={() => setCurrentIdx(x => x + 1)}>Next</button>
        <Suspense fallback={<span>Waiting</span>}>
          <Result idx={currentIdx} />
        </Suspense>
      </div>
    )
  }

  it("supports suspense", () => {
    const subs = observables[2].subscribe()
    render(<TestSuspense />)

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result 10")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result 20")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result 10")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result")).toBeNull()
    expect(screen.queryByText("Waiting")).not.toBeNull()

    fireEvent.click(screen.getByText(/Next/i))

    expect(screen.queryByText("Result 20")).not.toBeNull()
    expect(screen.queryByText("Waiting")).toBeNull()
    subs.unsubscribe()
  })
})

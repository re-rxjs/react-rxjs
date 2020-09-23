import React, { Component, ErrorInfo, useEffect } from "react"
import { Observable, throwError, concat, Subject } from "rxjs"
import { mergeMapTo, take, filter } from "rxjs/operators"
import { bind, Subscribe } from "@react-rxjs/core"
import { batchUpdates } from "./"
import { act, render, screen } from "@testing-library/react"

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

const next$ = new Subject<{ batched: boolean; error: boolean }>()
const [useLatestNumber, latestNumber$] = bind(
  (batched: boolean, error: boolean) => {
    return concat(
      [0],
      next$.pipe(
        filter((x) => x.batched === batched && x.error === error),
        take(1),
        mergeMapTo(error ? throwError("controlled error") : [1, 2, 3, 4, 5]),
        batched ? batchUpdates() : (x: Observable<number>) => x,
      ),
    )
  },
)

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

interface Props {
  onRender: () => void
  batched?: boolean
  error?: boolean
}
const Grandson: React.FC<Props> = ({ onRender, batched, error }) => {
  const latestNumber = useLatestNumber(!!batched, !!error)
  useEffect(onRender)
  return <div>Grandson {latestNumber}</div>
}

const Son: React.FC<Props> = (props) => {
  const latestNumber = useLatestNumber(!!props.batched, !!props.error)
  useEffect(props.onRender)
  return (
    <div>
      Son {latestNumber}
      <Grandson {...props} />
    </div>
  )
}

const Father: React.FC<Props> = (props) => {
  const latestNumber = useLatestNumber(!!props.batched, !!props.error)
  useEffect(props.onRender)
  return (
    <div>
      Father {latestNumber}
      <Son {...props} />
    </div>
  )
}

describe("batchUpdates", () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = (...args: any) => {
      if (
        /inside a test was not wrapped in act/.test(args[0]) ||
        /Uncaught 'controlled error'/.test(args[0]) ||
        /using the error boundary .* TestErrorBoundary/.test(args[0])
      ) {
        return
      }
      originalError.call(console, ...args)
    }
  })

  test("it triggers nested updates when batchUpdates is not used", async () => {
    const mockFn = jest.fn()
    render(
      <Subscribe source$={latestNumber$(false, false)}>
        <Father onRender={mockFn} />
      </Subscribe>,
    )
    expect(screen.queryByText("Father 0")).not.toBeNull()
    expect(screen.queryByText("Son 0")).not.toBeNull()
    expect(screen.queryByText("Grandson 0")).not.toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(3)

    await act(async () => {
      await wait(100)
      next$.next({ batched: false, error: false })
    })

    expect(screen.queryByText("Father 5")).not.toBeNull()
    expect(screen.queryByText("Son 5")).not.toBeNull()
    expect(screen.queryByText("Grandson 5")).not.toBeNull()
    expect(mockFn.mock.calls.length > 20).toBe(true)
  })

  test("batchUpdates prevents unnecessary updates", async () => {
    const mockFn = jest.fn()
    render(
      <Subscribe source$={latestNumber$(true, false)}>
        <Father batched onRender={mockFn} />
      </Subscribe>,
    )

    expect(screen.queryByText("Father 0")).not.toBeNull()
    expect(screen.queryByText("Son 0")).not.toBeNull()
    expect(screen.queryByText("Grandson 0")).not.toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(3)

    await act(async () => {
      await wait(100)
      next$.next({ batched: true, error: false })
    })

    expect(screen.queryByText("Father 5")).not.toBeNull()
    expect(screen.queryByText("Son 5")).not.toBeNull()
    expect(screen.queryByText("Grandson 5")).not.toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(6)
  })

  test("batchUpdates doesn't get in the way of Error Boundaries", async () => {
    const mockFn = jest.fn()
    const errorCallback = jest.fn()
    render(
      <TestErrorBoundary onError={errorCallback}>
        <Father batched error onRender={mockFn} />
      </TestErrorBoundary>,
    )
    expect(screen.queryByText("Father 0")).not.toBeNull()
    expect(screen.queryByText("Son 0")).not.toBeNull()
    expect(screen.queryByText("Grandson 0")).not.toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(3)

    await act(async () => {
      next$.next({ batched: true, error: true })
    })

    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
    expect(mockFn).toHaveBeenCalledTimes(3)
  })
})

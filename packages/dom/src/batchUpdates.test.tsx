import React, { Component, ErrorInfo, useLayoutEffect } from "react"
import { Observable, from, throwError } from "rxjs"
import { delay, startWith } from "rxjs/operators"
import { bind } from "@react-rxjs/core"
import { batchUpdates } from "./"
import { render, screen } from "@testing-library/react"

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

const [useLatestNumber] = bind(
  (id: string, batched: boolean) =>
    (id === "error"
      ? throwError("controlled error")
      : from([1, 2, 3, 4, 5])
    ).pipe(
      delay(5),
      batched ? batchUpdates() : (x: Observable<number>) => x,
      startWith(0),
    ),
  0,
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
  batched: boolean
  id: string
}
const Grandson: React.FC<Props> = ({ onRender, batched, id }) => {
  const latestNumber = useLatestNumber(id, batched)
  useLayoutEffect(onRender)
  return <div>Grandson {latestNumber}</div>
}

const Son: React.FC<Props> = (props) => {
  const latestNumber = useLatestNumber(props.id, props.batched)
  useLayoutEffect(props.onRender)
  return (
    <div>
      Son {latestNumber}
      <Grandson {...props} />
    </div>
  )
}

const Father: React.FC<Props> = (props) => {
  const latestNumber = useLatestNumber(props.id, props.batched)
  useLayoutEffect(props.onRender)
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
    render(<Father id="noBatching" batched={false} onRender={mockFn} />)
    expect(screen.queryByText("Father 0")).not.toBeNull()
    expect(screen.queryByText("Son 0")).not.toBeNull()
    expect(screen.queryByText("Grandson 0")).not.toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(3)

    await wait(10)

    expect(screen.queryByText("Father 5")).not.toBeNull()
    expect(screen.queryByText("Son 5")).not.toBeNull()
    expect(screen.queryByText("Grandson 5")).not.toBeNull()
    expect(mockFn.mock.calls.length > 20).toBe(true)
  })

  test("batchUpdates prevents unnecessary updates", async () => {
    const mockFn = jest.fn()
    render(<Father id="batchingAndComplete" batched={true} onRender={mockFn} />)
    expect(screen.queryByText("Father 0")).not.toBeNull()
    expect(screen.queryByText("Son 0")).not.toBeNull()
    expect(screen.queryByText("Grandson 0")).not.toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(3)

    await wait(10)

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
        <Father id="error" batched={true} onRender={mockFn} />
      </TestErrorBoundary>,
    )
    expect(screen.queryByText("Father 0")).not.toBeNull()
    expect(screen.queryByText("Son 0")).not.toBeNull()
    expect(screen.queryByText("Grandson 0")).not.toBeNull()
    expect(mockFn).toHaveBeenCalledTimes(3)

    await wait(10)

    expect(mockFn).toHaveBeenCalledTimes(3)
    expect(errorCallback).toHaveBeenCalledWith(
      "controlled error",
      expect.any(Object),
    )
  })
})

import { connectFactoryObservable } from "../src"
import { from, of, defer, concat } from "rxjs"
import { renderHook } from "@testing-library/react-hooks"
import { map } from "rxjs/operators"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("connectObservable", () => {
  it("returns the latest emitted value", async () => {
    const [useNumber] = connectFactoryObservable((id: number) => of(id))
    const { result } = renderHook(() => useNumber(1))
    expect(result.current).toBe(1)
  })

  it("shares the source subscription until the refCount has stayed at zero for the grace-period", async () => {
    let nInitCount = 0
    const observable$ = defer(() => {
      nInitCount += 1
      return from([1, 2, 3, 4, 5])
    })

    const [useLatestNumber] = connectFactoryObservable(
      (id: number) => concat(observable$, of(id)),
      {
        unsubscribeGraceTime: 100,
      },
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

    await wait(101)
    renderHook(() => useLatestNumber(6))
    expect(nInitCount).toBe(2)
  })

  test("getObservable can take an object as the key", async () => {
    const obj1 = {
      foo: "foo",
    }
    const obj2 = {
      foo: "foo2",
    }
    const obj3 = {
      foo: "foo3",
    }

    let count = 0

    const [useFoo] = connectFactoryObservable((obj: { foo: string }) =>
      defer(() => {
        count++
        return of(obj.foo).pipe(map(text => [text, count].join(".")))
      }),
    )

    const firstMount = renderHook(
      (props: { obj: { foo: string } }) => useFoo(props.obj),
      { initialProps: { obj: obj1 } },
    )
    expect(firstMount.result.current).toBe("foo.1")

    firstMount.rerender({ obj: obj2 })
    expect(firstMount.result.current).toBe("foo2.2")

    firstMount.rerender({ obj: obj3 })
    expect(firstMount.result.current).toBe("foo3.3")

    firstMount.rerender({ obj: obj1 })
    expect(firstMount.result.current).toBe("foo.1")

    firstMount.rerender({ obj: obj2 })
    expect(firstMount.result.current).toBe("foo2.2")

    firstMount.rerender({ obj: obj3 })
    expect(firstMount.result.current).toBe("foo3.3")

    firstMount.unmount()
    await wait(210)

    const secondMount = renderHook(
      (props: { obj: { foo: string } }) => useFoo(props.obj),
      { initialProps: { obj: obj1 } },
    )
    expect(secondMount.result.current).toBe("foo.4")

    secondMount.rerender({ obj: obj2 })
    expect(secondMount.result.current).toBe("foo2.5")

    secondMount.rerender({ obj: obj3 })
    expect(secondMount.result.current).toBe("foo3.6")

    secondMount.rerender({ obj: obj1 })
    expect(secondMount.result.current).toBe("foo.4")

    secondMount.rerender({ obj: obj2 })
    expect(secondMount.result.current).toBe("foo2.5")

    secondMount.rerender({ obj: obj3 })
    expect(secondMount.result.current).toBe("foo3.6")

    secondMount.unmount()
  })
})

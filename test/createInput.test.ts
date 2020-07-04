import { createInput } from "../src"
import { scan } from "rxjs/operators"
import { EMPTY_VALUE } from "../src/internal/empty-value"

describe("createInput", () => {
  test("the first subscription doesn't receive anything", () => {
    const [, getCounter, setCounter] = createInput<number>()
    const key = "foo"
    let value: number | typeof EMPTY_VALUE = EMPTY_VALUE
    setCounter(10, key)
    const sub = getCounter(key).subscribe(x => {
      value = x
    })
    expect(value).toBe(EMPTY_VALUE)
    sub.unsubscribe()
  })

  test("it accepts void inputs", () => {
    const [, getClicks$, onClick] = createInput()

    let latestValue: number | undefined = undefined
    const sub = getClicks$("foo")
      .pipe(scan(prev => prev + 1, 0))
      .subscribe(x => {
        latestValue = x
      })

    expect(latestValue).toBe(undefined)

    onClick("foo")
    onClick("foo")
    onClick("foo")
    onClick("foo")

    expect(latestValue).toBe(4)

    sub.unsubscribe()
  })

  it("throws when the dispatcher is called without a key", () => {
    const [, , onClick] = createInput()
    expect(() => onClick(1 as any)).toThrow()
  })

  test("it replays the latest value to new subscriptions", () => {
    const [, getCounter, setCounter] = createInput<number>()
    const sub1 = getCounter("foo").subscribe()
    setCounter(100, "foo")

    let value = 0
    const sub2 = getCounter("foo").subscribe(x => {
      value = x
    })

    expect(value).toBe(100)
    sub1.unsubscribe()
    sub2.unsubscribe()
  })

  test("it restarts after everyone unsubscribes", () => {
    const [, getCounter, setCounter] = createInput<number>()
    const sub1 = getCounter("foo").subscribe()
    const sub2 = getCounter("foo").subscribe()
    setCounter(100, "foo")

    sub1.unsubscribe()
    sub2.unsubscribe()

    let value: number | typeof EMPTY_VALUE = EMPTY_VALUE
    const sub3 = getCounter("foo").subscribe(x => {
      value = x
    })
    expect(value).toBe(EMPTY_VALUE)
    sub3.unsubscribe()
  })
})

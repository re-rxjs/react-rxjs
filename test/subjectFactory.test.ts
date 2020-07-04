import { subjectFactory } from "../src"
import { scan } from "rxjs/operators"
import { EMPTY_VALUE } from "../src/internal/empty-value"

describe("createSubjectsFactory", () => {
  test("it releasess the subject when is no longer needed", () => {
    const getDiffs$ = subjectFactory<string, number>()
    const key = "foo"
    let fooSubject = getDiffs$(key)

    expect(getDiffs$(key)).toBe(fooSubject)

    const sub1 = getDiffs$(key).subscribe()
    const sub2 = getDiffs$(key).subscribe()
    const sub3 = getDiffs$(key).subscribe()

    expect(getDiffs$(key)).toBe(fooSubject)
    expect(fooSubject.closed).toBe(false)

    sub1.unsubscribe()
    sub2.unsubscribe()
    expect(getDiffs$(key)).toBe(fooSubject)
    expect(fooSubject.closed).toBe(false)

    sub3.unsubscribe()
    expect(getDiffs$(key)).not.toBe(fooSubject)
    expect(fooSubject.closed).toBe(true)

    fooSubject = getDiffs$(key)
    expect(getDiffs$(key)).toBe(fooSubject)

    fooSubject.complete()
    expect(getDiffs$(key)).not.toBe(fooSubject)
    expect(fooSubject.closed).toBe(true)

    fooSubject = getDiffs$(key)
    fooSubject.error("")
    expect(getDiffs$(key)).not.toBe(fooSubject)
    expect(fooSubject.closed).toBe(true)
  })

  test("it multicasts", () => {
    const getDiffs$ = subjectFactory<string, number>()
    const key = "foo"

    const initialState: {
      latest: number | undefined
      completed: boolean
      error: any
    } = {
      latest: undefined,
      completed: false,
      error: undefined,
    }

    let sub1State = { ...initialState }
    getDiffs$(key).subscribe({
      next(v) {
        sub1State.latest = v
      },
      complete() {
        sub1State.completed = true
      },
    })

    let sub2State = { ...initialState }
    getDiffs$(key).subscribe({
      next(v) {
        sub2State.latest = v
      },
      complete() {
        sub2State.completed = true
      },
    })

    let sub3State = { ...initialState }
    getDiffs$(key).subscribe({
      next(v) {
        sub3State.latest = v
      },
      complete() {
        sub3State.completed = true
      },
    })

    expect(sub1State.latest).toBe(undefined)
    expect(sub2State.latest).toBe(undefined)
    expect(sub3State.latest).toBe(undefined)

    getDiffs$(key).next(10)
    expect(sub1State.latest).toBe(10)
    expect(sub2State.latest).toBe(10)
    expect(sub3State.latest).toBe(10)

    getDiffs$(key).next(100)
    expect(sub1State.latest).toBe(100)
    expect(sub2State.latest).toBe(100)
    expect(sub3State.latest).toBe(100)

    getDiffs$(key).complete()
    expect(sub1State.completed).toBe(true)
    expect(sub2State.completed).toBe(true)
    expect(sub3State.completed).toBe(true)

    sub1State = { ...initialState }
    getDiffs$(key).subscribe({
      next(v) {
        sub1State.latest = v
      },
      complete() {
        sub1State.completed = true
      },
      error(e) {
        sub1State.error = e
      },
    })

    sub2State = { ...initialState }
    getDiffs$(key).subscribe({
      next(v) {
        sub2State.latest = v
      },
      complete() {
        sub2State.completed = true
      },
      error(e) {
        sub2State.error = e
      },
    })

    sub3State = { ...initialState }
    getDiffs$(key).subscribe({
      next(v) {
        sub3State.latest = v
      },
      complete() {
        sub3State.completed = true
      },
      error(e) {
        sub3State.error = e
      },
    })

    expect(sub1State.latest).toBe(undefined)
    expect(sub2State.latest).toBe(undefined)
    expect(sub3State.latest).toBe(undefined)

    getDiffs$(key).next(10)
    expect(sub1State.latest).toBe(10)
    expect(sub2State.latest).toBe(10)
    expect(sub3State.latest).toBe(10)

    getDiffs$(key).error("error")
    expect(sub1State.error).toBe("error")
    expect(sub2State.error).toBe("error")
    expect(sub3State.error).toBe("error")

    getDiffs$(key).next(1000)
    expect(sub1State.latest).toBe(10)
    expect(sub2State.latest).toBe(10)
    expect(sub3State.latest).toBe(10)
  })

  test("the first subscription doesn't receive anything", () => {
    const getDiffs$ = subjectFactory<string, number>()
    const key = "foo"
    let value: number | typeof EMPTY_VALUE = EMPTY_VALUE
    getDiffs$(key).next(10)
    const sub = getDiffs$(key).subscribe(x => {
      value = x
    })
    expect(value).toBe(EMPTY_VALUE)
    sub.unsubscribe()
  })

  test("it accepts void inputs", () => {
    const getClicks$ = subjectFactory<string, void>()
    const key = "foo"

    let latestValue: number | undefined = undefined
    const sub = getClicks$(key)
      .pipe(scan(prev => prev + 1, 0))
      .subscribe(x => {
        latestValue = x
      })

    expect(latestValue).toBe(undefined)

    getClicks$(key).next()
    getClicks$(key).next()
    getClicks$(key).next()
    getClicks$(key).next()

    expect(latestValue).toBe(4)

    sub.unsubscribe()
  })

  test("it does not replay values to new subscriptions", () => {
    const getDiffs$ = subjectFactory<string, number>()
    const key = "foo"
    const sub1 = getDiffs$(key).subscribe()
    getDiffs$(key).next(100)

    let value = EMPTY_VALUE as any
    const sub2 = getDiffs$(key).subscribe(x => {
      value = x
    })

    expect(value).toBe(EMPTY_VALUE)
    sub1.unsubscribe()
    sub2.unsubscribe()
  })
})

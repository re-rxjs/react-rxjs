import {} from "react/experimental"
import { defer, of, Subject, Observable, NEVER, concat } from "rxjs"
import { SUSPENSE } from "../src"
import { useObservable } from "../src/useObservable"
import { renderHook, act } from "@testing-library/react-hooks"
import { delay, switchMap, startWith } from "rxjs/operators"
import { unstable_useTransition as useTransition, useEffect } from "react"
import { BehaviorObservable, distinctShareReplay } from "../src"
import reactEnhancer from "../src/operators/react-enhancer"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

const enhancer = <T>(source$: Observable<T>) =>
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

  const userId$ = new Subject<number>()
  const getUser = (id: number) =>
    of({ id, name: `name_${id}` }).pipe(delay(200))

  const user$ = userId$
    .pipe(
      switchMap(id => getUser(id).pipe(startWith(SUSPENSE))),
      startWith({ id: 1, name: "name_1" }),
    )
    .pipe(enhancer) as BehaviorObservable<any>

  const useUserTransition = () => {
    const [startTransition, isPending] = useTransition({ timeoutMs: 500 })
    useEffect(() => {
      setTimeout(() => {
        startTransition(() => {
          userId$.next(8)
        })
      }, 100)
    }, [])
    // console.log("isPending", isPending)
    return isPending
  }

  it.skip("works with useTransition", async () => {
    const { result: userResult } = renderHook(() => useObservable(user$))
    const { result: transitionResult } = renderHook(() => useUserTransition())

    expect(userResult.current).toEqual({ id: 1, name: "name_1" })
    expect(transitionResult.current).toBe(false)

    await act(async () => {
      await wait(120)
    })

    expect(userResult.current).toEqual({ id: 1, name: "name_1" })
    expect(transitionResult.current).toBe(true)

    await act(async () => {
      await wait(220)
    })

    expect(userResult.current).toEqual({ id: 8, name: "name_8" })
    expect(transitionResult.current).toBe(false)
  })
})

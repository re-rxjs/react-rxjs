import {} from "react/experimental"
import { defer, from, of, Subject, Observable } from "rxjs"
import { SUSPENSE } from "../src"
import { useObservable } from "../src/useObservable"
import { renderHook, act } from "@testing-library/react-hooks"
import { concatMap, delay, switchMap, startWith } from "rxjs/operators"
import { unstable_useTransition as useTransition, useEffect } from "react"
import {
  distinctShareReplay,
  BehaviorObservable,
} from "../src/operators/distinct-share-replay"
import reactEnhancer from "../src/operators/react-enhancer"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

const enhancer = <T>(source$: Observable<T>) =>
  reactEnhancer(source$.pipe(distinctShareReplay()), 200)

describe("useObservable", () => {
  it("works", async () => {
    let counter = 0
    const source$ = defer(() => {
      counter++
      return from([1, 2, 3, 4]).pipe(concatMap(x => of(x).pipe(delay(10))))
    }).pipe(enhancer) as BehaviorObservable<number>

    const { result } = renderHook(() => useObservable(source$))

    expect(result.current).toBe(null)

    await act(async () => {
      await wait(10)
    })
    expect(result.current).toEqual(1)
    expect(counter).toBe(1)

    await act(async () => {
      await wait(40)
    })

    expect(result.current).toEqual(4)
    expect(counter).toBe(1)
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

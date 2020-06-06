import { defer, from, of } from "rxjs"
import { useObservable } from "../src"
import { renderHook, act } from "@testing-library/react-hooks"
import { concatMap, delay } from "rxjs/operators"

const wait = (ms: number) => new Promise(res => setTimeout(res, ms))

describe("useObservable", () => {
  it("works", async () => {
    let counter = 0
    const source$ = defer(() => {
      counter++
      return from([1, 2, 3, 4]).pipe(concatMap(x => of(x).pipe(delay(10))))
    })

    const { result } = renderHook(() =>
      useObservable(source$, 0, {
        suspenseTime: 0,
        unsubscribeGraceTime: 0,
      }),
    )

    expect(result.current).toEqual(0)
    expect(counter).toBe(1)

    await act(async () => {
      await wait(50)
    })

    expect(result.current).toEqual(4)
    expect(counter).toBe(1)
  })
})

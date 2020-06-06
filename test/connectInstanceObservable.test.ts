import { connectInstanceObservable } from "../src"
import { of, Subject, Observable, combineLatest, merge } from "rxjs"
import { renderHook, act } from "@testing-library/react-hooks"
import {
  ignoreElements,
  switchMap,
  distinctUntilChanged,
  scan,
  shareReplay,
  tap,
  map,
  startWith,
} from "rxjs/operators"
import { groupInMap } from "@josepot/rxjs-utils"

const getPriceData = (key: string, period: number) =>
  of(
    key
      .split("")
      .map((_, idx) => idx)
      .concat(period),
  )

const tagAndPeriod$ = new Subject<[string, number]>()
const tagsData$ = tagAndPeriod$.pipe(
  groupInMap(
    ([tag]) => tag,
    stream$ =>
      stream$.pipe(
        scan((maxPeriod, [, period]) => Math.max(maxPeriod, period), 0),
        distinctUntilChanged(),
        switchMap(period => getPriceData(stream$.key, period)),
      ),
  ),
  startWith(new Map()),
  shareReplay(1),
)
const empty: number[] = []
const usePriceData = connectInstanceObservable(
  (props$: Observable<[string, number]>) => {
    const plug$ = props$.pipe(tap(tagAndPeriod$), ignoreElements())

    const data$ = props$.pipe(
      map(([tag]) => tag),
      distinctUntilChanged(),
      switchMap(tag =>
        tagsData$.pipe(
          map(tags => tags.get(tag) || empty),
          distinctUntilChanged(),
        ),
      ),
    )

    const periods$ = props$.pipe(
      map(([, period]) => period),
      distinctUntilChanged(),
    )

    return merge(combineLatest(data$, periods$), plug$).pipe(
      map(([data, period]) => data.slice(-period)),
    ) as Observable<number[]>
  },
  [],
)

describe("connectInstanceObservable", () => {
  it("works", () => {
    const { result, rerender } = renderHook(
      ({ tag, period }: { tag: string; period: number }) =>
        usePriceData(tag, period),
      { initialProps: { tag: "hello", period: 9 } },
    )

    expect(result.current).toEqual([0, 1, 2, 3, 4, 9])

    act(() => {
      rerender({ tag: "hello", period: 2 })
    })

    expect(result.current).toEqual([4, 9])

    act(() => {
      rerender({ tag: "ups", period: 8 })
    })

    expect(result.current).toEqual([0, 1, 2, 8])

    act(() => {
      rerender({ tag: "012345", period: 10 })
    })

    expect(result.current).toEqual([0, 1, 2, 3, 4, 5, 10])
  })

  it("also works with one argument", () => {
    const useDoubles = connectInstanceObservable(
      (props$: Observable<number>) => props$.pipe(map(x => x * 2)),
      null,
    )

    const { result, rerender } = renderHook(
      ({ input }: { input: number }) => useDoubles(input),
      { initialProps: { input: 1 } },
    )

    expect(result.current).toEqual(2)

    act(() => {
      rerender({ input: 2 })
    })

    expect(result.current).toEqual(4)
  })
})

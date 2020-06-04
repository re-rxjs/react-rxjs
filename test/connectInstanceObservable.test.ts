import { connectInstanceObservable } from "../src"
import { of, Subject, Observable, combineLatest, merge } from "rxjs"
import { renderHook } from "@testing-library/react-hooks"
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
  (tags$: Observable<string>, periods$: Observable<number>) => {
    const plug$ = combineLatest(tags$, periods$).pipe(
      tap(tagAndPeriod$),
      ignoreElements(),
    )

    const data$ = tags$.pipe(
      switchMap(tag =>
        tagsData$.pipe(
          map(tags => tags.get(tag) || empty),
          distinctUntilChanged(),
        ),
      ),
    )

    return combineLatest(data$, merge(periods$, plug$)).pipe(
      map(([data, period]) => data.slice(-period)),
    )
  },
  [],
)

describe("connectInstanceObservable", () => {
  it("works", async () => {
    const { result } = renderHook(() => usePriceData("hello", 9))

    expect(result.current).toEqual([0, 1, 2, 3, 4, 9])
  })
})

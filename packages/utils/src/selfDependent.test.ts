import {
  map,
  withLatestFrom,
  pluck,
  share,
  takeWhile,
  switchMapTo,
  delay,
} from "rxjs/operators"
import { TestScheduler } from "rxjs/testing"
import { selfDependent } from "."
import { merge, Observable, defer, of } from "rxjs"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

const inc = (x: number) => x + 1
describe("selfDependent", () => {
  it("emits the key of the stream that emitted the value", () => {
    scheduler().run(({ expectObservable, expectSubscriptions, cold }) => {
      let source: Observable<any>

      const clicks$ = defer(() => source)
      const [_resetableCounter$, connect] = selfDependent<number>()
      const inc$ = clicks$.pipe(
        withLatestFrom(_resetableCounter$),
        pluck("1"),
        map(inc),
        share(),
      )

      const delayedZero$ = of(0).pipe(delay(2))
      const reset$ = inc$.pipe(switchMapTo(delayedZero$))

      const resetableCounter$ = merge(inc$, reset$, of(0)).pipe(
        connect(),
        takeWhile((x) => x < 4, true),
      )

      source = cold("    -***---**---*****--")
      const sourceSub = "^--------------!   "
      const expected = " abcd-a-bc-a-bcd(e|)"

      expectObservable(resetableCounter$).toBe(expected, {
        a: 0,
        b: 1,
        c: 2,
        d: 3,
        e: 4,
      })
      expectSubscriptions((source as any).subscriptions).toBe(sourceSub)
    })
  })
})

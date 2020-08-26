import { TestScheduler } from "rxjs/testing"
import { from, merge, defer } from "rxjs"
import { shareLatest } from "./"
import { withLatestFrom, startWith, map } from "rxjs/operators"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("shareLatest", () => {
  describe("public shareLatest", () => {
    // prettier-ignore
    it("should restart due to unsubscriptions", () => {
    scheduler().run(({ expectObservable, expectSubscriptions, cold }) => {
      const sourceSubs = []
      const source = cold("a-b-c-d-e-f-g-h-i-j")
      sourceSubs.push("   ^------!----------------------")
      sourceSubs.push("   -----------^------------------")
      const sub1 = "      ^------!"
      const expected1 = " a-b-c-d-"
      const sub2 = "      -----------^------------------"
      const expected2 = " -----------a-b-c-d-e-f-g-h-i-j"

      const shared = shareLatest()(source)

      expectObservable(shared, sub1).toBe(expected1)
      expectObservable(shared, sub2).toBe(expected2)
      expectSubscriptions(source.subscriptions).toBe(sourceSubs)
    })
  })

    // prettier-ignore
    it("should restart due to unsubscriptions when the source has completed", () => {
    scheduler().run(({ expectObservable, expectSubscriptions, cold }) => {
      const sourceSubs = []
      const source = cold('a-(b|)          ');
      sourceSubs.push(    '-^-!            ');
      sourceSubs.push(    '-----------^-!');
      const sub1 =        '-^--!          ';
      const expected1 =   '-a-(b|)         ';
      const sub2 =        '-----------^--!';
      const expected2 =   '-----------a-(b|)';

      const shared = shareLatest()(source)

      expectObservable(shared, sub1).toBe(expected1);
      expectObservable(shared, sub2).toBe(expected2);
      expectSubscriptions(source.subscriptions).toBe(sourceSubs);
    })
    })

    // prettier-ignore
    it("should be able to handle recursively synchronous subscriptions", () => {
    scheduler().run(({ expectObservable, hot }) => {
      const values$ = hot('----b-c-d---')
      const latest$ = hot('----------x-')
      const expected = '   a---b-c-d-d-'
      const input$ = merge(
        values$,
        latest$.pipe(
          withLatestFrom(defer(() => result$)),
          map(([, latest]) => latest)
        )
      )

      const result$ = input$.pipe(
        startWith('a'),
        shareLatest()
      )

      expectObservable(result$, '^').toBe(expected)
    })
    })

    // prettier-ignore
    it("should not skip values on a sync source", () => {
    scheduler().run(({ expectObservable }) => {
      const source = from(['a', 'b', 'c', 'd']) // cold("(abcd|)")
      const sub1 =         '^';
      const expected1 = "  (abcd|)"

      const shared = shareLatest()(source);

      expectObservable(shared, sub1).toBe(expected1);
    })
  })
  })
})

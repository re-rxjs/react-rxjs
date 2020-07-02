import { SUSPENSE, shareLatest } from "../../src"
import shareLatestInternal from "../../src/internal/share-latest"
import { EMPTY_VALUE } from "../../src/internal/empty-value"
import { TestScheduler } from "rxjs/testing"
import { Subject, from } from "rxjs"

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

  describe("shareLatest Internal: Returns a BehaviorObservable which exposes a getValue function", () => {
    it("getValue returns the latest emitted value", () => {
      const input = new Subject<string>()
      const obs$ = shareLatestInternal(input)

      const subscription = obs$.subscribe()

      input.next("foo")
      expect(obs$.getValue()).toBe("foo")

      input.next("bar")
      expect(obs$.getValue()).toBe("bar")

      subscription.unsubscribe()
    })

    it("getValue throws EMPTY_VALUE if nothing has been emitted", () => {
      const input = new Subject<string>()
      const obs$ = shareLatestInternal(input)

      const subscription = obs$.subscribe()
      let error: any
      try {
        obs$.getValue()
      } catch (e) {
        error = e
      }
      expect(error).toBe(EMPTY_VALUE)
      subscription.unsubscribe()
    })

    it("getValue throws SUSPENSE if the latest emitted value is SUSPENSE", () => {
      const input = new Subject<any>()
      const obs$ = shareLatestInternal(input)

      const subscription = obs$.subscribe()
      input.next(SUSPENSE)
      let error: any
      try {
        obs$.getValue()
      } catch (e) {
        error = e
      }
      expect(error).toBe(SUSPENSE)
      subscription.unsubscribe()
    })
  })
})

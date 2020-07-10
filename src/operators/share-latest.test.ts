import { TestScheduler } from "rxjs/testing"
import { from } from "rxjs"
import { shareLatest } from "../"

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
})

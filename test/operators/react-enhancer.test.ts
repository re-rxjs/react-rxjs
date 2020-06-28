import reactEnhancer from "../../src/internal/react-enhancer"
import { shareLatest, SUSPENSE } from "../../src"
import { BehaviorObservable } from "../../src/internal/BehaviorObservable"
import { TestScheduler } from "rxjs/testing"
import { Subject } from "rxjs"

const scheduler = () =>
  new TestScheduler((actual, expected) => {
    expect(actual).toEqual(expected)
  })

describe("operators/reactEnhancer", () => {
  // prettier-ignore
  it("delays the latest unsubscription", () => {
    scheduler().run(({ expectObservable, expectSubscriptions, hot }) => {
      const sourceSubs = []
      const source = hot("a-b-c-d-e-f-g-h-i-j")
      sourceSubs.push("   ^---------!        ")
      sourceSubs.push("   --^------------!   ")
      const sub1 = "      ^------!           "
      const expected1 = " a-b-c-d            "
      const sub2 = "      --^-------!        "
      const expected2 = " --b-c-d-e          "

      const shared = reactEnhancer(source, 5)

      expectObservable(shared, sub1).toBe(expected1)
      expectObservable(shared, sub2).toBe(expected2)
      expectSubscriptions(source.subscriptions).toBe(sourceSubs)
    })
  })

  // prettier-ignore
  it("does not delay the unsubscription when the delayTime is zero", () => {
    scheduler().run(({ expectObservable, expectSubscriptions, hot }) => {
      const sourceSubs = []
      const source = hot("a-b-c-d-e-f-g-h-i-j")
      sourceSubs.push("   ^------!----------------------")
      sourceSubs.push("   --^--------!------------------")
      const sub1 = "      ^------!"
      const expected1 = " a-b-c-d-----------------------"
      const sub2 = "      --^--------!-----------"
      const expected2 = " --b-c-d-e-f-------------------"

      const shared = reactEnhancer(source, 0)

      expectObservable(shared, sub1).toBe(expected1)
      expectObservable(shared, sub2).toBe(expected2)
      expectSubscriptions(source.subscriptions).toBe(sourceSubs)
    })
  })

  // prettier-ignore
  it("does not unsubscribe from the latest when the delayTime is Infinity", () => {
    scheduler().run(({ expectObservable, expectSubscriptions, hot }) => {
      const sourceSubs = []
      const source = hot("a-b-c-d-e-f-g-h-i-j")
      sourceSubs.push("   ^---------!-------------------")
      sourceSubs.push("   --^---------------------------")
      const sub1 = "      ^------!"
      const expected1 = " a-b-c-d-----------------------"
      const sub2 = "      --^-------!------------"
      const expected2 = " --b-c-d-e---------------------"

      const shared = reactEnhancer(source, Infinity)

      expectObservable(shared, sub1).toBe(expected1)
      expectObservable(shared, sub2).toBe(expected2)
      expectSubscriptions(source.subscriptions).toBe(sourceSubs)
    })
  })

  describe("Returns a BehaviorObservable which exposes a getValue function", () => {
    it("getValue returns the latest emitted value", () => {
      const input = new Subject<string>()
      const obs$ = reactEnhancer(
        input.pipe(shareLatest()),
        0,
      ) as BehaviorObservable<string>

      const subscription = obs$.subscribe()

      input.next("foo")
      expect(obs$.getValue()).toBe("foo")

      input.next("bar")
      expect(obs$.getValue()).toBe("bar")

      subscription.unsubscribe()
    })

    it("if nothing has been emitted, then getValue throws a promise that will resolve when the first value is emitted", async () => {
      const input = new Subject<string>()
      const obs$ = reactEnhancer(
        input.pipe(shareLatest()),
        0,
      ) as BehaviorObservable<string>

      const subscription = obs$.subscribe()
      let error: any
      try {
        obs$.getValue()
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(Promise)

      setTimeout(() => input.next("foo"), 10)
      await expect(error).resolves.toBe("foo")

      subscription.unsubscribe()
    })

    it("if the latest emitted value is SUSPENSE, then getValue throws a promise that will resolve when the next non SUSPENSE value is emitted", async () => {
      const input = new Subject<any>()
      const obs$ = reactEnhancer(
        input.pipe(shareLatest()),
        0,
      ) as BehaviorObservable<any>

      const subscription = obs$.subscribe()
      let error: any
      try {
        obs$.getValue()
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(Promise)

      setTimeout(() => input.next(SUSPENSE), 10)
      setTimeout(() => input.next(SUSPENSE), 20)
      setTimeout(() => input.next("bar"), 30)
      await expect(error).resolves.toBe("bar")

      subscription.unsubscribe()
    })
  })
})

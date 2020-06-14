import reactEnhancer from "../../src/operators/react-enhancer"
import { TestScheduler } from "rxjs/testing"

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
})

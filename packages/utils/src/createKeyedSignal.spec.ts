import { createKeyedSignal } from "./"

describe("createKeyedSignal", () => {
  it("receives a key selector and a mapper and returns a tuple with an observable-getter and its corresponding event-emitter", () => {
    const [getFooBar$, onFooBar] = createKeyedSignal(
      (x) => x.key,
      (foo: number, bar: string, key: string) => ({ foo, bar, key }),
    )

    let receivedValue1
    let nHits1 = 0
    const subscription1 = getFooBar$("key").subscribe((val) => {
      receivedValue1 = val
      nHits1++
    })

    expect(receivedValue1).toBe(undefined)
    onFooBar(0, "1", "key")
    expect(receivedValue1).toEqual({ foo: 0, bar: "1", key: "key" })
    expect(nHits1).toBe(1)

    let receivedValue2
    let nHits2 = 0
    const subscription2 = getFooBar$("key").subscribe((val) => {
      receivedValue2 = val
      nHits2++
    })

    expect(receivedValue2).toBe(undefined)

    onFooBar(1, "2", "key")
    expect(receivedValue1).toEqual({ foo: 1, bar: "2", key: "key" })
    expect(nHits1).toBe(2)
    expect(receivedValue2).toEqual({ foo: 1, bar: "2", key: "key" })
    expect(nHits2).toBe(1)

    onFooBar(1, "2", "key2")
    expect(nHits1).toBe(2)
    expect(nHits2).toBe(1)

    subscription1.unsubscribe()
    subscription2.unsubscribe()
  })

  it('returns a tuple with a typed observable and its corresponding event-emitter when no "event creator" is provided', () => {
    const [foo$, onFoo] = createKeyedSignal<string>()
    let receivedValue
    foo$("foo").subscribe((val) => {
      receivedValue = val
    })
    expect(receivedValue).toBe(undefined)
    onFoo("foo")
    expect(receivedValue).toEqual("foo")
  })
})

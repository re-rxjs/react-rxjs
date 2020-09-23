import { createListener } from "./"

describe("createListener", () => {
  it('receives an "event creator" and it returns a tuple with an observable and its corresponding event-emitter', () => {
    const [fooBar$, onFooBar] = createListener((foo: number, bar: string) => ({
      foo,
      bar,
    }))
    let receivedValue
    fooBar$.subscribe((val) => {
      receivedValue = val
    })
    expect(receivedValue).toBe(undefined)
    onFooBar(0, "1")
    expect(receivedValue).toEqual({ foo: 0, bar: "1" })
  })
  it('returns a tuple with a typed observable and its corresponding event-emitter when no "event creator" is provided', () => {
    const [foo$, onFoo] = createListener<string>()
    let receivedValue
    foo$.subscribe((val) => {
      receivedValue = val
    })
    expect(receivedValue).toBe(undefined)
    onFoo("foo")
    expect(receivedValue).toEqual("foo")
  })
  it('returns a tuple with a void observable and its corresponding event-emitter when no "event creator" and no type is provided', () => {
    const [clicks$, onClick] = createListener()
    let count = 0
    clicks$.subscribe(() => {
      count++
    })
    expect(count).toBe(0)
    onClick()
    expect(count).toBe(1)
  })
})

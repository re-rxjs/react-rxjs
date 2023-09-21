import "expose-gc"
import { expect } from "vitest"

export function testFinalizationRegistry() {
  const promises = new Map<
    string,
    Promise<string> & { resolve: (tag: string) => void }
  >()

  const finalizationRegistry = new FinalizationRegistry((tag: any) => {
    promises.get(tag)!.resolve(tag)
  })
  function tag<T extends object>(tag: string, v: T) {
    if (promises.has(tag)) {
      throw new Error("TestFinalizationRegistry: tags must be unique")
    }
    let resolve = (_tag: string) => {}
    const promise = new Promise<string>((res) => {
      resolve = res
    })
    Object.assign(promise, { resolve })
    promises.set(tag, promise as any)
    finalizationRegistry.register(v, tag)
    return v
  }

  return {
    tag,
    assertFinalized(tag: string) {
      global.gc!()
      const promise = promises.get(tag)
      expect(promise).not.toBe(undefined)
      // I was doing expect(promise).resolves.toEqual(tag), but that's not testing what it should
      // `promise` will resolve when the object gets garbage-collected, if it doesn't, the test times out.
      // This is equivalent to just awaiting the promise:
      return promise
    },
  }
}

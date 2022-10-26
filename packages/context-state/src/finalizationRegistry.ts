import "expose-gc"

export function testFinalizationRegistry() {
  const promises = new Map<
    string,
    Promise<string> & { resolve: (tag: string) => void }
  >()

  const finalizationRegistry = new FinalizationRegistry((tag: any) => {
    if (!promises.has(tag)) {
      const promise = Object.assign(Promise.resolve(tag), { resolve: () => {} })
      promises.set(tag, promise)
    } else {
      promises.get(tag)!.resolve(tag)
    }
  })
  function tag<T extends object>(tag: string, v: T) {
    if (!promises.has(tag)) {
      let resolve = (_tag: string) => {}
      const promise = new Promise<string>((res) => {
        resolve = res
      })
      Object.assign(promise, { resolve })
      promises.set(tag, promise as any)
      finalizationRegistry.register(v, tag)
    }
    return v
  }

  return {
    tag,
    getPromise(tag: string) {
      return promises.get(tag)!
    },
    gc() {
      global.gc!()
    },
  }
}

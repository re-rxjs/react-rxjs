import { Observable } from "rxjs"
import { unstable_batchedUpdates } from "react-dom"

/**
 * A RxJS pipeable operator which observes the source observable on
 * an asapScheduler and uses `ReactDom.unstable_batchedUpdates` to emmit the
 * values. It's useful for observing streams of events that come from outside
 * of ReactDom event-handlers.
 *
 * @remarks This operator will be deprecated when React 17 is released
 * (or whnever React CM is released). The reason being that React Concurrent Mode
 * automatically batches all synchrous updates. Meaning that with React CM,
 * observing a stream through the asapScheduler accomplishes the same thing.
 */
export const batchUpdates = <T>() => (
  source$: Observable<T>,
): Observable<T> => {
  return new Observable<T>((observer) => {
    const obs = {
      n: (v: T) => observer.next(v),
      c: () => observer.complete(),
      e: (e: any) => observer.error(e),
    }
    let queue: ["n" | "c" | "e", any?][] = []
    let promise: Promise<void> | null = null
    const flush = () => {
      promise = null
      const originalQueue = queue
      queue = []
      unstable_batchedUpdates(() => {
        originalQueue.forEach(([prop, val]) => obs[prop](val))
      })
    }
    const push = (type: "n" | "c" | "e") => (val?: any) => {
      queue.push([type, val])
      if (!promise) {
        promise = Promise.resolve().then(flush)
      }
    }
    return source$.subscribe(push("n"), push("e"), push("c"))
  })
}

import { Subject, Observable } from "rxjs"
import { connectDispatcher } from "./connectDispatcher"
import shareLatest from "./internal/share-latest"

interface CreateInput {
  /**
   * Creates a pool of void observables identified by strings, and returns:
   *   - A React Hook that returns a void dispatcher for a given key
   *   - A function that returns the observable by key
   *   - A function that makes the observable emit by key
   */
  (): [
    () => () => void,
    (key: string) => Observable<void>,
    (key: string) => void,
  ]
  /**
   * Creates a pool of observables identified by strings, and returns:
   *   - A React Hook that returns a dispatcher for a given key
   *   - A function that returns the observable by key
   *   - A function that updates the observable value by key
   *
   * @param defaultValue Default value.
   */
  <T>(): [
    (key: string) => (value: T) => void,
    (key: string) => Observable<T>,
    (update: T, key: string) => void,
  ]
}

const createInput_ = <T>() => {
  const cache = new Map<string, [Subject<T>, Observable<T>]>()
  const getEntry = (key: string) => {
    let result = cache.get(key)
    if (result) return result
    const subject = new Subject<T>()
    const source = shareLatest(subject, () => cache.delete(key))
    result = [subject, source]
    cache.set(key, result)
    return result
  }

  const getObservable = (key: string) => getEntry(key)[1]
  const dispatcher = (value: T, key: string) => {
    if (key === undefined) {
      if (typeof value !== "string") {
        throw new Error("dispatcher called without a key")
      }
      return getEntry(value)[0].next()
    }
    getEntry(key)[0].next(value)
  }
  const useDispatcher = connectDispatcher(getObservable, dispatcher)

  return [useDispatcher, getObservable, dispatcher] as const
}

/**
 * Creates a pool of observables identified by strings, and returns:
 *   - A React Hook that returns a dispatcher for a given key.
 *   - A function that returns the observable by key
 *   - A function that updates the observable value by key
 */
export const createInput = createInput_ as CreateInput

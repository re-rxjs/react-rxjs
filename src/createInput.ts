import { Subject, Observable, ReplaySubject } from "rxjs"
import shareLatest from "./internal/share-latest"

interface CreateInput {
  /**
   * Creates a pool of void observables identified by strings, and returns:
   *   - A function that returns the observable by key
   *   - A function that makes the observable emit by key
   */
  (): [(key: string) => Observable<void>, (key: string) => void]
  /**
   * Creates a pool of observables identified by strings, and returns:
   *   - A function that returns the observable by key
   *   - A function that updates the observable value by key
   *
   * @param defaultValue Default value.
   */
  <T>(defaultValue?: T): [
    (key: string) => Observable<T>,
    (key: string, update: T | ((prev: T) => T)) => void,
  ]
}

const empty = Symbol("empty") as any
const createInput_ = <T>(defaultValue: T = empty) => {
  const cache = new Map<string, [Subject<T>, { latest: T }, Observable<T>]>()
  const getEntry = (key: string) => {
    let result = cache.get(key)
    if (result) return result
    const subject = new ReplaySubject<T>()
    const current = {} as { latest: T }
    if (defaultValue !== empty) {
      subject.next((current.latest = defaultValue))
    }
    const source = shareLatest(true, () => cache.delete(key))(
      subject,
    ) as Observable<T>
    result = [subject, current, source]
    cache.set(key, result)
    return result
  }

  const onChange = (key: string, value: T | ((prev: T) => T)) => {
    const [subject, current] = getEntry(key)
    const nextVal =
      typeof value === "function" ? (value as any)(current.latest) : value
    subject.next((current.latest = nextVal))
  }
  const getSource = (key: string) => getEntry(key)[2]
  return [getSource, onChange] as const
}

/**
 * Creates a pool of observables identified by strings, and returns:
 *   - A function that returns the observable by key
 *   - A function that updates the observable value by key
 */
export const createInput = createInput_ as CreateInput

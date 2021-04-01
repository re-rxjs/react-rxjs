import { GroupedObservable, identity, Observable, Observer } from "rxjs"

/**
 * Creates a "keyed" signal. It's sugar for splitting the Observer and the Observable of a keyed signal.
 *
 * @returns [1, 2]
 * 1. The getter function that returns the GroupedObservable<T, T>
 * 2. The emitter function.
 */
export function createKeyedSignal<T>(): [
  (key: T) => GroupedObservable<T, T>,
  (key: T) => void,
]

/**
 * Creates a "keyed" signal. It's sugar for splitting the Observer and the Observable of a keyed signal.
 *
 * @param keySelector a function that extracts the key from the emitted value
 * @returns [1, 2]
 * 1. The getter function that returns the GroupedObservable<K, T>
 * 2. The emitter function.
 */
export function createKeyedSignal<T, K, A extends any[]>(
  keySelector: (signal: T) => K,
): [(key: K) => GroupedObservable<K, T>, (signal: T) => void]

/**
 * Creates a "keyed" signal. It's sugar for splitting the Observer and the Observable of a keyed signal.
 *
 * @param keySelector a function that extracts the key from the emitted value
 * @param mapper a function that maps the arguments of the emitter function to the value of the GroupedObservable
 * @returns [1, 2]
 * 1. The getter function that returns the GroupedObservable<K, T>
 * 2. The emitter function (...args: any[]) => T.
 */
export function createKeyedSignal<T, K, A extends any[]>(
  keySelector: (signal: T) => K,
  mapper: (...args: A) => T,
): [(key: K) => GroupedObservable<K, T>, (...args: A) => void]

export function createKeyedSignal<T, K, A extends any[]>(
  keySelector: (signal: T) => K = identity as any,
  mapper: (...args: A) => T = identity as any,
): [(key: K) => GroupedObservable<K, T>, (...args: A) => void] {
  const observersMap = new Map<K, Set<Observer<T>>>()

  return [
    (key: K) => {
      const res = new Observable<T>((observer) => {
        if (!observersMap.has(key)) {
          observersMap.set(key, new Set())
        }
        const set = observersMap.get(key)!
        set.add(observer)
        return () => {
          set.delete(observer)
          if (set.size === 0) {
            observersMap.delete(key)
          }
        }
      }) as GroupedObservable<K, T>
      res.key = key
      return res
    },
    (...args: A) => {
      const payload = mapper(...args)
      observersMap.get(keySelector(payload))?.forEach((o) => {
        o.next(payload)
      })
    },
  ]
}

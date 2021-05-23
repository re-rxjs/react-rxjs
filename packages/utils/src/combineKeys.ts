import { Observable, Subscription } from "rxjs"

export interface MapWithChanges<K, V> extends Map<K, V> {
  changes: Set<K>
}

/**
 * Creates a stream that combines the result of the streams from each key of the input stream.
 *
 * @param keys$ Stream of the list of keys to subscribe to.
 * @param getInner$ Function that returns the stream for each key.
 * @returns An stream with a map containing the latest value from the stream of each key.
 */
export const combineKeys = <K, T>(
  keys$: Observable<Array<K> | Set<K>>,
  getInner$: (key: K) => Observable<T>,
): Observable<MapWithChanges<K, T>> =>
  new Observable((observer) => {
    const innerSubscriptions = new Map<K, Subscription>()
    let changes = new Set<K>()
    const currentValue = new Map<K, T>()
    let updatingSource = false
    const next = () => {
      if (!updatingSource) {
        const result = Object.assign(new Map(currentValue), {
          changes,
        })
        changes = new Set<K>()
        observer.next(result)
      }
    }

    const subscription = keys$.subscribe(
      (nextKeysArr) => {
        updatingSource = true
        const nextKeys = new Set(nextKeysArr)
        innerSubscriptions.forEach((sub, key) => {
          if (!nextKeys.has(key)) {
            sub.unsubscribe()
            innerSubscriptions.delete(key)
            if (currentValue.has(key)) {
              changes.add(key)
              currentValue.delete(key)
            }
          } else {
            nextKeys.delete(key)
          }
        })
        nextKeys.forEach((key) => {
          innerSubscriptions.set(
            key,
            getInner$(key).subscribe(
              (x) => {
                if (!currentValue.has(key) || currentValue.get(key) !== x) {
                  changes.add(key)
                  currentValue.set(key, x)
                  next()
                }
              },
              (e) => {
                observer.error(e)
              },
            ),
          )
        })
        updatingSource = false
        if (changes.size) next()
      },
      (e) => {
        observer.error(e)
      },
      () => {
        observer.complete()
      },
    )

    return () => {
      subscription.unsubscribe()
      innerSubscriptions.forEach((sub) => {
        sub.unsubscribe()
      })
    }
  })

import { Observable, Subscription } from "rxjs"

export const mergeActiveKeys = <K, T>(
  activeKeys$: Observable<Iterable<K>>,
  getInner$: (key: K) => Observable<T>,
): Observable<Map<K, T>> =>
  new Observable((observer) => {
    const innerSubscriptions = new Map<K, Subscription>()
    const currentValue = new Map<K, T>()
    let updatingSource = false
    const next = () => {
      if (!updatingSource) observer.next(new Map(currentValue))
    }

    const subscription = activeKeys$.subscribe(
      (nextKeysArr) => {
        updatingSource = true
        const nextKeys = new Set(nextKeysArr)
        let changes = false
        innerSubscriptions.forEach((sub, key) => {
          if (!nextKeys.has(key)) {
            changes = true
            sub.unsubscribe()
            currentValue.delete(key)
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
                  changes = true
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
        if (changes) next()
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

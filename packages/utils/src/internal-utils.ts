import { Observable, GroupedObservable, Subscription } from "rxjs"
import { shareLatest } from "@react-rxjs/core"

export const defaultStart = <T, D>(value: D) => (source$: Observable<T>) =>
  new Observable<T | D>((observer) => {
    let emitted = false
    const subscription = source$.subscribe(
      (x) => {
        emitted = true
        observer.next(x)
      },
      (e) => {
        observer.error(e)
      },
      () => {
        observer.complete()
      },
    )

    if (!emitted) {
      observer.next(value)
    }

    return subscription
  })

export const collector = <K, V, VV>(
  enhancer: (source: GroupedObservable<K, V>) => Observable<VV>,
): ((
  source: Observable<GroupedObservable<K, V>>,
) => Observable<Map<K, VV>>) => (source$) =>
  new Observable<Map<K, VV>>((observer) => {
    const subscription = new Subscription()
    const map = new Map<K, VV>()
    let emitted = false

    subscription.add(
      source$.subscribe(
        (x) => {
          subscription.add(
            enhancer(x).subscribe(
              (v) => {
                map.set(x.key, v)
                emitted = true
                observer.next(map)
              },
              (e) => {
                observer.error(e)
              },
              () => {
                map.delete(x.key)
                observer.next(map)
              },
            ),
          )
        },
        (e) => {
          observer.error(e)
        },
        () => {
          map.clear()
          observer.next(map)
          observer.complete()
        },
      ),
    )
    if (!emitted) observer.next(map)
    return subscription
  }).pipe(shareLatest())

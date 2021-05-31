import { GroupedObservable, Observable, Subscription } from "rxjs"

export const getGroupedObservable = <K, T>(
  source$: Observable<Map<K, GroupedObservable<K, T>>>,
  key: K,
) => {
  const result = new Observable<T>((observer) => {
    let innerSub: Subscription | undefined
    let outterSub: Subscription = source$.subscribe(
      (n) => {
        innerSub = innerSub || n.get(key)?.subscribe(observer)
      },
      (e) => {
        observer.error(e)
      },
      () => {
        observer.complete()
      },
    )
    return () => {
      innerSub?.unsubscribe()
      outterSub.unsubscribe()
    }
  }) as GroupedObservable<K, T>
  ;(result as any).key = key
  return result
}

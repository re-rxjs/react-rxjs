import {
  GroupedObservable,
  Observable,
  OperatorFunction,
  pipe,
  Subscription,
} from "rxjs"
import {
  startWith,
  endWith,
  ignoreElements,
  map,
  distinctUntilChanged,
  skipWhile,
} from "rxjs/operators"
import { CollectorAction, collector } from "./internal-utils"

const defaultFilter = pipe(ignoreElements(), startWith(true), endWith(false))

export type CollectedObservable<K, V> = Observable<
  Map<K, GroupedObservable<K, V>>
> & {
  get: (key: K) => Observable<V>
}

/**
 * A pipeable operator that collects all the GroupedObservables emitted by
 * the source and emits a Map with the active inner observables
 *
 * @param filter? A function that receives the inner Observable and returns an
 * Observable of boolean values, which indicates whether the inner observable
 * should be collected.
 */
export const collect = <K, V>(
  filter?: (source$: GroupedObservable<K, V>) => Observable<boolean>,
): ((
  source$: Observable<GroupedObservable<K, V>>,
) => CollectedObservable<K, V>) => {
  const enhancer = filter
    ? (source$: GroupedObservable<K, V>) =>
        filter(source$).pipe(
          endWith(false),
          skipWhile((x) => !x),
          distinctUntilChanged(),
        )
    : defaultFilter

  const operator: OperatorFunction<
    GroupedObservable<K, V>,
    Map<K, GroupedObservable<K, V>>
  > = collector((o) =>
    map((x) => ({
      t: x ? (CollectorAction.Set as const) : (CollectorAction.Delete as const),
      k: o.key,
      v: o,
    }))(enhancer(o)),
  )

  return (source$) => {
    const result$ = operator(source$)
    const get = (key: K) =>
      new Observable<V>((observer) => {
        let innerSub: Subscription | undefined
        let outterSub: Subscription = result$.subscribe(
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
          innerSub && innerSub.unsubscribe()
          outterSub.unsubscribe()
        }
      })
    return Object.assign(result$, { get })
  }
}

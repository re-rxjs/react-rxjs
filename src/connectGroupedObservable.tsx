import { useMemo } from "react"
import { Observable, GroupedObservable } from "rxjs"
import { map, filter, take, concatMap, shareReplay } from "rxjs/operators"
import distinctShareReplay from "./operators/distinct-share-replay"
import { FactoryObservableOptions, defaultFactoryOptions } from "./options"
import useSharedReplayableObservable from "./useSharedReplayableObservable"

const connectGroupedObservable = <K, O, I>(
  source$: Observable<GroupedObservable<K, O>>,
  initialValue: I,
  _options?: FactoryObservableOptions<O>,
): [
  (key: K) => I | O,
  () => () => void,
  (key: K) => GroupedObservable<K, O>,
] => {
  const options = {
    ...defaultFactoryOptions,
    ..._options,
  }
  const observables = new Map<K, Observable<O>>()
  const activeObservables$ = source$.pipe(
    map(x => {
      observables.set(
        x.key,
        x.pipe(
          distinctShareReplay(options.compare, () => observables.delete(x.key)),
        ),
      )
      return observables
    }),
    shareReplay(1),
  )

  const getObservableByKey = (key: K) => {
    const result = activeObservables$.pipe(
      filter(x => x.has(key)),
      take(1),
      concatMap(x => x.get(key)!),
    ) as GroupedObservable<K, O>
    result.key = key
    return result
  }

  const hook = (key: K) =>
    useSharedReplayableObservable(
      useMemo(() => getObservableByKey(key), [key]),
      initialValue,
      options,
    )

  const getGroupSubscription = () => {
    const subscription = activeObservables$.subscribe()
    return () => subscription.unsubscribe()
  }

  return [hook, getGroupSubscription, getObservableByKey]
}

export default connectGroupedObservable

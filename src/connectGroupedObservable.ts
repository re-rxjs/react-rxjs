import { Observable, GroupedObservable } from "rxjs"
import { map, filter, take, mergeMap } from "rxjs/operators"
import distinctShareReplay from "./operators/distinct-share-replay"
import { FactoryObservableOptions, defaultFactoryOptions } from "./options"
import useSharedReplayableObservable from "./useSharedReplayableObservable"

const connectGroupedObservable = <K, O, I>(
  source$: Observable<GroupedObservable<K, O>>,
  initialValue: I,
  _options?: FactoryObservableOptions<O>,
): [(key: K) => I | O, (key: K) => Observable<O>] => {
  const options = {
    ...defaultFactoryOptions,
    ..._options,
  }
  const observables = new Map<K, Observable<O>>()
  const activeObservables$ = source$.pipe(
    map(x => {
      observables.set(x.key, x)
      return observables
    }),
    distinctShareReplay(
      () => false,
      () => observables.clear(),
    ),
  )

  const getObservableByKey = (key: K) =>
    activeObservables$.pipe(
      filter(x => x.has(key)),
      take(1),
      mergeMap(x => x.get(key)!),
      distinctShareReplay(options.compare, () => observables.delete(key)),
    )

  const hook = (key: K) =>
    useSharedReplayableObservable(
      getObservableByKey(key),
      initialValue,
      options,
    )

  return [hook, getObservableByKey]
}

export default connectGroupedObservable

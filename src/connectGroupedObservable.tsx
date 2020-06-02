import { Observable, GroupedObservable, Subject } from "rxjs"
import { filter, take, concatMap } from "rxjs/operators"
import distinctShareReplay from "./operators/distinct-share-replay"
import { FactoryObservableOptions, defaultFactoryOptions } from "./options"
import useSharedReplayableObservable from "./useSharedReplayableObservable"

const connectGroupedObservable = <K, O, I>(
  source$: Observable<GroupedObservable<K, O>>,
  initialValue: I,
  _options?: FactoryObservableOptions<O>,
): [(key: K) => I | O, () => () => void, (key: K) => Observable<O>] => {
  const options = {
    ...defaultFactoryOptions,
    ..._options,
  }
  const cache = new Map<K, GroupedObservable<K, O>>()
  const innerSubject$ = new Subject<GroupedObservable<K, O>>()
  const subscribe = () => {
    const subscription = source$
      .subscribe(inner$ => {
        const enhanced$ = inner$.pipe(
          distinctShareReplay(options.compare, () => cache.delete(inner$.key)),
        ) as GroupedObservable<K, O>
        enhanced$.key = inner$.key
        if (cache.has(inner$.key)) {
          innerSubject$.next(enhanced$)
        } else {
          cache.set(inner$.key, enhanced$)
        }
      })
      .add(() => {
        cache.clear()
      })
    return () => subscription.unsubscribe()
  }

  const getObservableByKey = (key: K) => {
    let result = cache.get(key)
    if (result) {
      return result
    }
    result = innerSubject$.pipe(
      filter(inner$ => inner$.key === key),
      take(1),
      concatMap(x => x),
    ) as GroupedObservable<K, O>
    result.key = key
    cache.set(key, result)
    return result
  }

  const hook = (key: K) =>
    useSharedReplayableObservable(
      getObservableByKey(key),
      initialValue,
      options,
    )

  return [hook, subscribe, getObservableByKey]
}

export default connectGroupedObservable

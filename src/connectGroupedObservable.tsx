import React, { useMemo } from "react"
import { Observable, GroupedObservable } from "rxjs"
import { map, filter, take, concatMap } from "rxjs/operators"
import distinctShareReplay from "./operators/distinct-share-replay"
import { FactoryObservableOptions, defaultFactoryOptions } from "./options"
import useSharedReplayableObservable from "./useSharedReplayableObservable"
import { useLayoutEffect } from "react"

const connectGroupedObservable = <K, O, I>(
  source$: Observable<GroupedObservable<K, O>>,
  initialValue: I,
  _options?: FactoryObservableOptions<O>,
): [(key: K) => I | O, React.FC, (key: K) => Observable<O>] => {
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
    distinctShareReplay(
      () => false,
      () => observables.clear(),
    ),
  )

  const getObservableByKey = (key: K) =>
    activeObservables$.pipe(
      filter(x => x.has(key)),
      take(1),
      concatMap(x => x.get(key)!),
    )

  const hook = (key: K) =>
    useSharedReplayableObservable(
      useMemo(() => getObservableByKey(key), [key]),
      initialValue,
      options,
    )

  const GroupSubsriber: React.FC = ({ children }) => {
    useLayoutEffect(() => {
      const subscription = activeObservables$.subscribe()
      return () => subscription.unsubscribe()
    }, [])
    return <>{children}</>
  }

  return [hook, GroupSubsriber, getObservableByKey]
}

export default connectGroupedObservable

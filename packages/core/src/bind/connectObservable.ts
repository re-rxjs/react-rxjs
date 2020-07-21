import { Observable } from "rxjs"
import shareLatest from "../internal/share-latest"
import reactEnhancer from "../internal/react-enhancer"
import { useObservable } from "../internal/useObservable"
import { takeUntilComplete } from "../internal/take-until-complete"

/**
 * Accepts: An Observable.
 *
 * Returns [1, 2]
 * 1. A React Hook that yields the latest emitted value of the observable
 * 2. A `sharedLatest` version of the observable. It can be used for composing
 * other streams that depend on it. The shared subscription is closed as soon as
 * there are no subscribers to that observable.
 *
 * @param observable Source observable to be used by the hook.
 * @param unsubscribeGraceTime (= 200): Amount of time in ms that the shared
 * observable should wait before unsubscribing from the source observable when
 * there are no new subscribers.
 *
 * @remarks If the Observable doesn't synchronously emit a value upon the first
 * subscription, then the hook will leverage React Suspense while it's waiting
 * for the first value.
 */
export default function connectObservable<T>(
  observable: Observable<T>,
  unsubscribeGraceTime: number,
) {
  const sharedObservable$ = shareLatest<T>(observable)
  const reactObservable$ = reactEnhancer(
    sharedObservable$,
    unsubscribeGraceTime,
  )
  const outputObservable$ = takeUntilComplete(sharedObservable$)
  const useStaticObservable = () => useObservable(reactObservable$)
  return [useStaticObservable, outputObservable$] as const
}

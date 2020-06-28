import { Observable } from "rxjs"
import shareLatest from "./internal/share-latest"
import reactEnhancer from "./internal/react-enhancer"
import { useObservable } from "./internal/useObservable"

/**
 * Returns a hook that provides the latest update of the accepted observable,
 * and the underlying enhanced observable, which shares the subscription to all
 * of its subscribers, and always emits the latest value when subscribing to it.
 *
 * The shared subscription is closed as soon as there are no subscribers to that
 * observable.
 *
 * @param observable Source observable to be used by the hook.
 * @param unsubscribeGraceTime (= 200): Amount of time in ms that the shared
 *        observable should wait before unsubscribing from the source observable
 *        when there are no new subscribers.
 */
export function connectObservable<T>(
  observable: Observable<T>,
  unsubscribeGraceTime = 200,
) {
  const sharedObservable$ = shareLatest<T>(false)(observable)
  const reactObservable$ = reactEnhancer(
    sharedObservable$,
    unsubscribeGraceTime,
  )
  const useStaticObservable = () => useObservable(reactObservable$)
  return [useStaticObservable, sharedObservable$ as Observable<T>] as const
}

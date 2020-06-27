import { Observable, NEVER, concat } from "rxjs"
import { distinctShareReplay } from "./operators/distinct-share-replay"
import reactEnhancer from "./operators/react-enhancer"
import { useObservable } from "./useObservable"
import { ConnectorOptions, defaultConnectorOptions } from "./options"

/**
 * Returns a hook that provides the latest update of the accepted observable,
 * and the underlying enhanced observable, which shares the subscription to all
 * of its subscribers, and always emits the latest value when subscribing to it.
 *
 * The shared subscription is closed as soon as there are no subscribers to that
 * observable.
 *
 * @param observable Source observable to be used by the hook.
 * @param options ConnectorOptions:
 *  - unsubscribeGraceTime (= 200): Amount of time in ms that the shared
 *    observable should wait before unsubscribing from the source observable
 *    when there are no new subscribers.
 *  - compare (= Object.is): Equality function.
 */
export function connectObservable<T>(
  observable: Observable<T>,
  options?: ConnectorOptions<T>,
) {
  const _options = {
    ...defaultConnectorOptions,
    ...options,
  }
  const sharedObservable$ = distinctShareReplay(_options.compare)(
    concat(observable, NEVER),
  )

  const reactObservable$ = reactEnhancer(
    sharedObservable$,
    _options.unsubscribeGraceTime,
  )

  const useStaticObservable = () => useObservable(reactObservable$)

  return [useStaticObservable, sharedObservable$] as const
}

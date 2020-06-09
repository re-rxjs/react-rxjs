import { Observable, NEVER, concat } from "rxjs"
import distinctShareReplay from "./operators/distinct-share-replay"
import { StaticObservableOptions, defaultStaticOptions } from "./options"
import useObservable from "./useObservable"

export function connectObservable<T>(
  observable: Observable<T>,
  _options?: StaticObservableOptions<T>,
) {
  const options = {
    ...defaultStaticOptions,
    ..._options,
  }
  const sharedObservable$ = distinctShareReplay(options.compare)(
    concat(observable, NEVER),
  )

  const useStaticObservable = () =>
    useObservable(sharedObservable$, options.unsubscribeGraceTime)
  useStaticObservable.shared$ = sharedObservable$

  return [useStaticObservable, sharedObservable$] as const
}

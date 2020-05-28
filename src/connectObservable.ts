import { Observable } from "rxjs"
import distinctShareReplay from "./operators/distinct-share-replay"
import { StaticObservableOptions, defaultStaticOptions } from "./options"
import useSharedReplayableObservable from "./useSharedReplayableObservable"

export function connectObservable<O, IO>(
  observable: Observable<O>,
  initialValue: IO,
  _options?: StaticObservableOptions<O>,
) {
  const options = {
    ...defaultStaticOptions,
    ..._options,
  }
  const sharedObservable$ = observable.pipe(
    distinctShareReplay(options.compare),
  )

  const useStaticObservable = () =>
    useSharedReplayableObservable(sharedObservable$, initialValue, options)

  return [useStaticObservable, sharedObservable$] as const
}

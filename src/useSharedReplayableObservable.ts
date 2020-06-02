import { useState, useLayoutEffect } from "react"
import { Observable, of, race, concat } from "rxjs"
import { delay } from "rxjs/operators"
import delayUnsubscription from "./operators/delay-unsubscription"
import { defaultFactoryOptions, ObservableOptions } from "./options"

const useSharedReplayableObservable = <O, I>(
  sharedReplayableObservable$: Observable<O>,
  initialValue: I,
  options?: ObservableOptions,
) => {
  const { suspenseTime, unsubscribeGraceTime } = {
    ...defaultFactoryOptions,
    ...options,
  }
  const [state, setState] = useState<I | O>(initialValue)

  useLayoutEffect(() => {
    const updates$ = sharedReplayableObservable$.pipe(
      delayUnsubscription(unsubscribeGraceTime),
    )

    const subscription = (suspenseTime === Infinity
      ? updates$
      : race(
          concat(of(initialValue).pipe(delay(suspenseTime)), updates$),
          updates$,
        )
    ).subscribe(setState)

    return () => subscription.unsubscribe()
  }, [sharedReplayableObservable$, suspenseTime, unsubscribeGraceTime])

  return state
}

export default useSharedReplayableObservable

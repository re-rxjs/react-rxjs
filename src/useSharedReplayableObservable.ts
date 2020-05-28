import { useState, useLayoutEffect } from "react"
import { Observable, of, race, merge, NEVER } from "rxjs"
import { take, delay } from "rxjs/operators"
import reactOptimizations from "./operators/react-optimizations"
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
      reactOptimizations(unsubscribeGraceTime),
    )
    const initialState$ = race(
      suspenseTime === Infinity
        ? NEVER
        : of(initialValue).pipe(delay(suspenseTime)),
      sharedReplayableObservable$.pipe(take(1)),
    )

    const subscription = merge(updates$, initialState$).subscribe(setState)

    return () => subscription.unsubscribe()
  }, [sharedReplayableObservable$, suspenseTime, unsubscribeGraceTime])

  return state
}

export default useSharedReplayableObservable

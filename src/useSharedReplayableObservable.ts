import { useState, useEffect } from "react"
import { Observable, of, race } from "rxjs"
import { take, mapTo, delay } from "rxjs/operators"
import reactOptimizations from "./operators/react-optimizations"
import { defaultFactoryOptions, ObservableOptions } from "./options"

const useSharedReplayableObservable = <O, I>(
  sharedReplayableObservable$: Observable<O>,
  initialValue: I,
  options?: ObservableOptions,
) => {
  const [value, setValue] = useState<I | O>(initialValue)

  const { suspenseTime, unsubscribeGraceTime } = {
    ...defaultFactoryOptions,
    ...options,
  }

  useEffect(() => {
    const subscription = reactOptimizations(unsubscribeGraceTime)(
      sharedReplayableObservable$,
    ).subscribe(setValue)

    if (suspenseTime === 0) {
      setValue(initialValue)
    } else if (suspenseTime < Infinity) {
      subscription.add(
        race(
          of(initialValue).pipe(delay(suspenseTime)),
          sharedReplayableObservable$.pipe(
            take(1),
            mapTo((x: I | O) => x),
          ),
        ).subscribe(setValue),
      )
    }

    return () => subscription.unsubscribe()
  }, [sharedReplayableObservable$, suspenseTime, unsubscribeGraceTime])
  return value
}

export default useSharedReplayableObservable

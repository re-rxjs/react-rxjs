import { Observable } from "rxjs"
import { useEffect, useState } from "react"
import reactOperator from "./react-operator"
import batchUpdates from "./batch-updates"

export function connectObservable<O, IO>(
  observable: Observable<O>,
  initialValue: IO,
  gracePeriod?: number,
) {
  const reactObservable$ = reactOperator(observable, initialValue, gracePeriod)

  const useStaticObservable = () => {
    const [value, setValue] = useState<O | IO>(
      reactObservable$.getCurrentValue(),
    )
    useEffect(() => {
      const subscription = batchUpdates(reactObservable$).subscribe(setValue)
      return () => subscription.unsubscribe()
    }, [])
    return value
  }
  return [useStaticObservable, reactObservable$] as const
}

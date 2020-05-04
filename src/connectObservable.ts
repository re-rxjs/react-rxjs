import { Observable } from "rxjs"
import { useEffect, useState } from "react"
import reactOperator, { batchUpdates } from "./react-operator"

export function connectObservable<O, IO>(
  observable: Observable<O>,
  initialValue: IO,
) {
  const reactObservable$ = reactOperator(observable, initialValue)

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

import { Observable } from "rxjs"
import { useEffect, useState } from "react"
import reactOperator from "./react-operator"
import batchUpdates from "./batch-updates"

export interface StaticObservableOptions<T> {
  unsubscribeGraceTime: number
  compare: (a: T, b: T) => boolean
}
export const defaultStaticOptions: StaticObservableOptions<any> = {
  unsubscribeGraceTime: 100,
  compare: (a, b) => a === b,
}

export function connectObservable<O, IO>(
  observable: Observable<O>,
  initialValue: IO,
  options?: Partial<StaticObservableOptions<O>>,
) {
  const { unsubscribeGraceTime, compare } = {
    ...options,
    ...defaultStaticOptions,
  }
  const reactObservable$ = reactOperator(
    observable,
    initialValue,
    unsubscribeGraceTime,
    compare,
  )

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

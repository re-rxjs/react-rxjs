import { useEffect, useState } from "react"
import { Observable } from "rxjs"
import reactOptimizations from "./operators/react-optimizations"
import distinctShareReplay from "./operators/distinct-share-replay"

export interface StaticObservableOptions<T> {
  unsubscribeGraceTime: number
  compare: (a: T, b: T) => boolean
}
export const defaultStaticOptions: StaticObservableOptions<any> = {
  unsubscribeGraceTime: 120,
  compare: (a, b) => a === b,
}

export function connectObservable<O, IO>(
  observable: Observable<O>,
  initialValue: IO,
  options?: Partial<StaticObservableOptions<O>>,
) {
  const { unsubscribeGraceTime, compare } = {
    ...defaultStaticOptions,
    ...options,
  }
  const sharedObservable$ = observable.pipe(distinctShareReplay(compare))
  const reactObservable$ = sharedObservable$.pipe(
    reactOptimizations(unsubscribeGraceTime),
  )

  const useStaticObservable = () => {
    const [value, setValue] = useState<O | IO>(initialValue)
    useEffect(() => {
      const subscription = reactObservable$.subscribe(setValue)
      return () => subscription.unsubscribe()
    }, [])
    return value
  }
  return [useStaticObservable, sharedObservable$] as const
}

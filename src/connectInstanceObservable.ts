import { Observable, Subject } from "rxjs"
import { FactoryObservableOptions, defaultFactoryOptions } from "./options"
import { distinctUntilChanged } from "rxjs/operators"
import { useEffect, useRef, useLayoutEffect, useState } from "react"
import delayUnsubscription from "./operators/delay-unsubscription"

interface ConnectInstanceObservable {
  <I, T1, O>(
    getObservable: (a: Observable<T1>) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1) => O | I
  <I, T1, T2, O>(
    getObservable: (a: Observable<T1>, b: Observable<T2>) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2) => O | I
  <I, T1, T2, T3, O>(
    getObservable: (
      a: Observable<T1>,
      b: Observable<T2>,
      c: Observable<T3>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3) => O | I
  <I, T1, T2, T3, T4, O>(
    getObservable: (
      a: Observable<T1>,
      b: Observable<T2>,
      c: Observable<T3>,
      d: Observable<T4>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4) => O | I
  <I, T1, T2, T3, T4, T5, O>(
    getObservable: (
      a: Observable<T1>,
      b: Observable<T2>,
      c: Observable<T3>,
      d: Observable<T4>,
      e: Observable<T5>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5) => O | I
  <I, T1, T2, T3, T4, T5, T6, O>(
    getObservable: (
      a: Observable<T1>,
      b: Observable<T2>,
      c: Observable<T3>,
      d: Observable<T4>,
      e: Observable<T5>,
      f: Observable<T6>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5, f: T6) => O | I
  <I, T1, T2, T3, T4, T5, T6, T7, O>(
    getObservable: (
      a: Observable<T1>,
      b: Observable<T2>,
      c: Observable<T3>,
      d: Observable<T4>,
      e: Observable<T5>,
      f: Observable<T6>,
      g: Observable<T7>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5, f: T6, g: T7) => O | I
}

export const connectInstanceObservable: ConnectInstanceObservable = (
  getObservable: any,
  initialValue: any,
  _options?: any,
) => {
  const options = {
    ...defaultFactoryOptions,
    ..._options,
  }

  const useInstance = (...input: any) => {
    const subjectsRef = useRef<any>()
    const [state, setState] = useState(initialValue)

    useLayoutEffect(() => {
      const subjects = [] as Subject<any>[]
      for (let i = 0; i < getObservable.length; i++) {
        subjects.push(new Subject())
      }
      subjectsRef.current = subjects

      const inputs = subjects.map(s => s.pipe(distinctUntilChanged())) as any
      const subscription = getObservable(...inputs)
        .pipe(
          distinctUntilChanged(),
          delayUnsubscription(options.unsubscribeGraceTime),
        )
        .subscribe(setState)

      return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
      input.forEach((value: any, idx: any) =>
        subjectsRef.current![idx].next(value),
      )
    }, input)

    return state
  }

  return useInstance as any
}

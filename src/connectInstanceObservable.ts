import { Observable, BehaviorSubject } from "rxjs"
import { FactoryObservableOptions } from "./options"
import { map } from "rxjs/operators"
import { useEffect, useRef, useState } from "react"
import delayUnsubscription from "./operators/delay-unsubscription"
import { distinctShareReplay, BehaviorObservable } from "./"

interface ConnectInstanceObservable {
  <I, T1, T2, O>(
    getObservable: (props$: Observable<[T1, T2]>) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2) => O | I
  <I, T1, T2, T3, O>(
    getObservable: (props$: Observable<[T1, T2, T3]>) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3) => O | I
  <I, T1, T2, T3, T4, O>(
    getObservable: (props$: Observable<[T1, T2, T3, T4]>) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4) => O | I
  <I, T1, T2, T3, T4, T5, O>(
    getObservable: (props$: Observable<[T1, T2, T3, T4, T5]>) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5) => O | I
  <I, T1, T2, T3, T4, T5, T6, O>(
    getObservable: (
      props$: Observable<[T1, T2, T3, T4, T5, T6]>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5, f: T6) => O | I
  <I, T1, T2, T3, T4, T5, T6, T7, O>(
    getObservable: (
      props$: Observable<[T1, T2, T3, T4, T5, T6, T7]>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5, f: T6, g: T7) => O | I
  <I, T1, T2, T3, T4, T5, T6, T7, T8, O>(
    getObservable: (
      props$: Observable<[T1, T2, T3, T4, T5, T6, T7, T8]>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5, f: T6, g: T7, h: T8) => O | I
  <I, T1, T2, T3, T4, T5, T6, T7, T8, T9, O>(
    getObservable: (
      props$: Observable<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>,
    ) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1, b: T2, c: T3, d: T4, e: T5, f: T6, g: T7, h: T8, i: T9) => O | I
  <I, T1, O>(
    getObservable: (props$: Observable<T1>) => Observable<O>,
    initialValue: I,
    options?: FactoryObservableOptions<O>,
  ): (a: T1) => O | I
}

const flatSingleTuple = (src: Observable<Array<any>>) =>
  map((inputs: any) => (inputs.length === 1 ? inputs[0] : inputs))(src)

const cache = new WeakMap<
  React.MutableRefObject<any>,
  BehaviorObservable<any>
>()

const defaultValue: any = {}
export const connectInstanceObservable: ConnectInstanceObservable = (
  getObservable: any,
  unsubscribeGraceTime = 200,
) => {
  const getSuspendedState = (ref: React.MutableRefObject<any>, input: any) => {
    let source$ = cache.get(ref)
    if (source$) {
      return source$.getValue()
    }

    const subject = new BehaviorSubject(input)
    ref.current = subject
    source$ = delayUnsubscription(unsubscribeGraceTime)(
      distinctShareReplay()(subject.pipe(flatSingleTuple, getObservable)),
    )
    cache.set(ref, source$)
    return source$.getValue()
  }

  const useInstance = (...input: any) => {
    const subjectRef = useRef<any>()
    const [state, setState] = useState(defaultValue)

    useEffect(() => {
      const subscription = cache.get(subjectRef)!.subscribe(setState)
      return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
      if (subjectRef.current!.i) {
        subjectRef.current!.next(input)
      }
      subjectRef.current!.i = 1
    }, input)

    return state !== defaultValue ? state : getSuspendedState(subjectRef, input)
  }

  return useInstance as any
}

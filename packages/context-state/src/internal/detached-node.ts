import { Observable, ReplaySubject, Subscription } from "rxjs"
import type { StateNode, Ctx } from "../types"
import {
  EMPTY_VALUE,
  inactiveContext,
  invalidContext,
  StatePromise,
  DeferredPromise,
  createDeferredPromise,
  children,
  RunFn,
} from "./"
import { NestedMap } from "./nested-map"

export const detachedNode = <T, P>(
  getState$: (ctx: Ctx) => Observable<T>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): [StateNode<T>, RunFn<P>] => {
  const instances = new NestedMap<
    any,
    {
      subject: ReplaySubject<T>
      subscription: Subscription | null
      currentValue: EMPTY_VALUE | T
      currentParentValue: EMPTY_VALUE
      promise: DeferredPromise<T> | null
    }
  >()

  const result: StateNode<T> = {
    getValue: (...key: any[]) => {
      const instance = instances.get(key)
      if (!instance) throw inactiveContext()
      const { currentValue, promise } = instance
      if (currentValue !== EMPTY_VALUE) return currentValue
      if (promise) return promise.promise
      instance.promise = createDeferredPromise()
      return instance.promise.promise
    },
    state$: (...key: any[]) =>
      new Observable<T>((observer) => {
        const instance = instances.get(key)
        if (!instance) return observer.error(inactiveContext())
        return instance.subject.subscribe(observer)
      }),
  }

  const childRunners = new Set<RunFn<T>>()
  children.set(result, childRunners)

  const runChildren: RunFn<T> = (...args) => {
    childRunners.forEach((cb) => {
      cb(...args)
    })
  }

  const run = (key: any[], isActive: boolean, parentValue: any) => {
    let instance = instances.get(key)
    if (!isActive) {
      if (!instance) return
      instances.delete(key)

      instance.subscription?.unsubscribe()

      runChildren(key, false)
      instance.promise?.rej(inactiveContext())
      instance.subject.complete()
      return
    }

    if (parentValue !== EMPTY_VALUE) {
      // an actual change of context
      const hasPreviousValue = instance && instance.currentValue !== EMPTY_VALUE
      if (!instance) {
        instance = {
          subject: new ReplaySubject<T>(1),
          subscription: null,
          currentValue: EMPTY_VALUE,
          currentParentValue: EMPTY_VALUE,
          promise: null,
        }
        instances.set(key, instance)
      } else {
        instance.subscription?.unsubscribe()
        instance.currentValue = EMPTY_VALUE
        instance.currentParentValue = parentValue
      }
      const actualInstance = instance

      const ctx = <V>(node: StateNode<V>): V => {
        const value = (node as any).getValue(...key)
        if (value instanceof StatePromise) throw invalidContext()
        return value
      }

      const onError = (err: any) => {
        instances.delete(key)
        const prevPromise = actualInstance.promise
        const prevSubect = actualInstance.subject

        actualInstance.subscription = null
        actualInstance.promise = null
        delete (actualInstance as any).subject

        actualInstance.currentValue = EMPTY_VALUE
        actualInstance.currentParentValue = EMPTY_VALUE

        runChildren(key, false)
        prevPromise?.rej(err)
        prevSubect?.error(err)
      }

      let observable: Observable<any> | null = null
      try {
        observable = getState$(ctx)
      } catch (e) {
        onError(e)
      }

      actualInstance.subscription =
        observable?.subscribe({
          next(value) {
            let prevValue = actualInstance.currentValue
            actualInstance.currentValue = value
            const prevPromise = actualInstance.promise
            actualInstance.promise = null
            if (prevValue === EMPTY_VALUE || !equalityFn(prevValue, value)) {
              prevPromise?.res(value)
              runChildren(key, true, value)
              actualInstance.subject!.next(value)
            }
          },
          error: onError,
          complete() {
            actualInstance.subscription = null
          },
        }) ?? null

      if (actualInstance.subscription?.closed)
        actualInstance.subscription = null

      if (
        actualInstance.currentValue === EMPTY_VALUE &&
        actualInstance.subject
      ) {
        let prevSubect
        if (hasPreviousValue) {
          prevSubect = actualInstance.subject
          actualInstance.subject = new ReplaySubject<T>(1)
        }
        runChildren(key, true, EMPTY_VALUE)
        prevSubect?.complete()
      }
      return
    }

    // at this point parentValue is EMPTY_VALUE
    if (instance?.currentParentValue === EMPTY_VALUE) return
    const prevSubect = instance?.subject
    if (instance) {
      instance.subject = new ReplaySubject<T>(1)
      instance.subscription?.unsubscribe()
      instance.subscription = null
      instance.currentValue = EMPTY_VALUE
      instance.currentParentValue = EMPTY_VALUE
    } else {
      instance = {
        subject: new ReplaySubject<T>(1),
        subscription: null,
        currentValue: EMPTY_VALUE,
        currentParentValue: EMPTY_VALUE,
        promise: null,
      }
      instances.set(key, instance)
    }
    runChildren(key, true, EMPTY_VALUE)
    prevSubect?.complete()
  }

  return [result, run]
}

import { Observable, ReplaySubject, Subscription } from "rxjs"
import type { StateNode, Ctx } from "../types"
import {
  EMPTY_VALUE,
  inactiveContext,
  invalidContext,
  StatePromise,
  DeferredPromise,
  createDeferredPromise,
  globalChildRunners,
  globalIsActive,
  globalRunners,
  globalParents,
  RunFn,
} from "./"
import { NestedMap } from "./nested-map"

const recursiveError = (
  key: any[],
  start: StateNode<any>,
  searched: Set<StateNode<any>>,
): Error | undefined => {
  if (searched.has(start)) return undefined
  searched.add(start)
  const result = globalIsActive.get(start)!(key)
  if (result instanceof Error) return result
  if (result) return undefined

  const parents = globalParents.get(start)!
  if (!Array.isArray(parents)) return recursiveError(key, parents, searched)

  for (let i = 0; i < parents.length; i++) {
    const result = recursiveError(key, parents[i], searched)
    if (result) return result
  }
  return undefined
}

export const detachedNode = <T>(
  getState$: (ctx: Ctx) => Observable<T>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): StateNode<T> => {
  const instances = new NestedMap<
    any,
    {
      subject: ReplaySubject<T>
      subscription: Subscription | null
      currentValue: EMPTY_VALUE | T
      isParentLoaded: boolean
      promise: DeferredPromise<T> | null
      error: null | { e: any }
    }
  >()

  const result: StateNode<T> = {
    getValue: (...key: any[]) => {
      const instance = instances.get(key)
      if (!instance)
        throw recursiveError(key, result, new Set()) || inactiveContext()

      if (instance.error) throw instance.error.e
      const { currentValue, promise } = instance
      if (currentValue !== EMPTY_VALUE) return currentValue
      if (promise) return promise.promise
      instance.promise = createDeferredPromise()
      return instance.promise.promise
    },
    state$: (...key: any[]) =>
      new Observable<T>((observer) => {
        const instance = instances.get(key)
        return instance
          ? instance.subject.subscribe(observer)
          : observer.error(
              recursiveError(key, result, new Set()) || inactiveContext(),
            )
      }),
  }

  const runners: Array<RunFn> = []
  globalChildRunners.set(result, runners)
  globalIsActive.set(result, (key: any[]) => {
    const instance = instances.get(key)
    if (!instance) return false
    return instance.error?.e ?? true
  })

  const runChildren: RunFn = (...args) => {
    runners.forEach((cb) => {
      cb(...args)
    })
  }

  const run = (key: any[], isActive: boolean, isParentLoaded?: boolean) => {
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

    if (isParentLoaded) {
      // an actual change of context
      const hasPreviousValue = instance && instance.currentValue !== EMPTY_VALUE
      if (!instance) {
        instance = {
          subject: new ReplaySubject<T>(1),
          subscription: null,
          currentValue: EMPTY_VALUE,
          isParentLoaded,
          promise: null,
          error: null,
        }
        instances.set(key, instance)
      } else {
        instance.subscription?.unsubscribe()
        instance.currentValue = EMPTY_VALUE
        instance.isParentLoaded = true
      }
      const actualInstance = instance

      const ctx = <V>(node: StateNode<V>): V => {
        const value = (node as any).getValue(...key)
        if (value instanceof StatePromise) throw invalidContext()
        return value
      }

      const onError = (err: any) => {
        const prevPromise = actualInstance.promise

        actualInstance.error = { e: err }
        actualInstance.subscription = null
        actualInstance.promise = null

        actualInstance.currentValue = EMPTY_VALUE

        runChildren(key, false)
        prevPromise?.rej(err)
        actualInstance.subject.error(err)
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
              runChildren(key, true, true)
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
        !actualInstance.error &&
        actualInstance.currentValue === EMPTY_VALUE &&
        actualInstance.subject
      ) {
        let prevSubect
        if (hasPreviousValue) {
          prevSubect = actualInstance.subject
          actualInstance.subject = new ReplaySubject<T>(1)
        }
        runChildren(key, true, false)
        prevSubect?.complete()
      }
      return
    }

    if (instance?.isParentLoaded === false) return

    const prevSubect = instance?.subject
    if (instance) {
      instance.subject = new ReplaySubject<T>(1)
      instance.subscription?.unsubscribe()
      instance.subscription = null
      instance.currentValue = EMPTY_VALUE
      instance.isParentLoaded = false
    } else {
      instance = {
        subject: new ReplaySubject<T>(1),
        subscription: null,
        currentValue: EMPTY_VALUE,
        isParentLoaded: false,
        error: null,
        promise: null,
      }
      instances.set(key, instance)
    }
    runChildren(key, true, false)
    prevSubect?.complete()
  }

  globalRunners.set(result, run)

  return result
}

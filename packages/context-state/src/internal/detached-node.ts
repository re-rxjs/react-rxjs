import { Observable, ReplaySubject, Subscription } from "rxjs"
import type { CtxFn, Signal, StateNode, StringRecord } from "../types"
import {
  InternalStateNode,
  EMPTY_VALUE,
  inactiveContext,
  invalidContext,
  StatePromise,
  DeferredPromise,
  createDeferredPromise,
  getInternals,
  addInternals,
} from "./"
import { NestedMap } from "./nested-map"

export const recursiveError = (
  key: any[],
  start: InternalStateNode<any, any>,
  searched: Set<InternalStateNode<any, any>>,
): Error | undefined => {
  if (searched.has(start)) return undefined
  searched.add(start)
  const result = start.isActive(key)
  if (result instanceof Error) return result
  if (result) return undefined

  const parents = start.parents
  if (!Array.isArray(parents)) return recursiveError(key, parents, searched)

  for (let i = 0; i < parents.length; i++) {
    const result = recursiveError(key, parents[i], searched)
    if (result) return result
  }
  return undefined
}

interface Instance<T> {
  subject: ReplaySubject<T>
  onFlushQueue?: Array<() => void>
  subscription: Subscription | null
  currentValue: EMPTY_VALUE | T
  isParentLoaded: boolean
  promise: DeferredPromise<T> | null
  error: null | { e: any }
}

export const detachedNode = <T, K extends StringRecord<any>>(
  keysOrder: string[],
  getState$: CtxFn<T, K>,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): InternalStateNode<T, K> => {
  const instances = new NestedMap<any, Instance<T>>()

  const privateNode = {
    keysOrder,
    parents: [],
  } as unknown as InternalStateNode<T, K>

  const publicNode: StateNode<T, K> = {
    getValue: (keyObj = {} as K) => {
      const sortedKey = keysOrder.map((key) => keyObj[key])
      const instance = instances.get(sortedKey)
      if (!instance)
        throw (
          recursiveError(sortedKey, privateNode, new Set()) || inactiveContext()
        )

      if (instance.error) throw instance.error.e
      const { currentValue, promise } = instance
      if (currentValue !== EMPTY_VALUE) return currentValue
      if (promise) return promise.promise
      instance.promise = createDeferredPromise()
      return instance.promise.promise
    },
    getState$: (keyObj = {} as K) => {
      const sortedKey = keysOrder.map((key) => keyObj[key])

      return new Observable<T>((observer) => {
        const instance = instances.get(sortedKey)
        return instance
          ? instance.subject.subscribe(observer)
          : observer.error(
              recursiveError(sortedKey, privateNode, new Set()) ||
                inactiveContext(),
            )
      })
    },
  }
  privateNode.public = publicNode
  privateNode.childRunners = []

  privateNode.isActive = (key: any[]) => {
    const instance = instances.get(key)
    if (!instance) return false
    return instance.error?.e ?? true
  }

  privateNode.isRunning = (key: any[]) => {
    const instance = instances.get(key)
    if (instance?.onFlushQueue) return instance.onFlushQueue!
    if (Array.isArray(privateNode.parents)) {
      for (let i = 0; i < privateNode.parents.length; i++) {
        const result = privateNode.parents[i].isRunning(key)
        if (result) return result
      }
      return false
    } else {
      return privateNode.parents.isRunning(key)
    }
  }

  const runChildren: (
    instance: Instance<T>,
    key: any[],
    isActive: boolean,
    isParentLoaded?: boolean,
  ) => void = (instance, ...args) => {
    const waiters: Array<() => void> = []
    instance.onFlushQueue = waiters
    for (let i = 0; i < privateNode.childRunners.length; i++)
      privateNode.childRunners[i](...args)
    delete instance.onFlushQueue
    for (let i = 0; i < waiters.length; i++) waiters[i]()
  }

  privateNode.run = (
    key: any[],
    isActive: boolean,
    isParentLoaded?: boolean,
  ) => {
    let instance = instances.get(key)
    if (!isActive) {
      if (!instance) return
      instances.delete(key)

      instance.subscription?.unsubscribe()

      runChildren(instance, key, false)
      instance.promise?.rej(inactiveContext())
      instance.subject.complete()
      return
    }

    if (isParentLoaded) {
      // an actual change of context
      let previousValue = instance ? instance.currentValue : EMPTY_VALUE
      const hasPreviousValue = previousValue !== EMPTY_VALUE

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

      const objKey = {} as K
      keysOrder.forEach((keyName, idx) => {
        ;(objKey as any)[keyName] = key[idx]
      })

      const ctxValue = <V>(node: StateNode<V, any>): V => {
        const value = node.getValue(objKey)
        if (value instanceof StatePromise) throw invalidContext()
        return value
      }

      const ctxObservable = <V, CK extends StringRecord<any>>(
        node: StateNode<V, CK> | Signal<V, CK>,
        partialKey: Omit<CK, keyof K>,
      ): Observable<V> => {
        const internalNode = getInternals(
          "getSignal$" in node ? node.parent : node,
        )

        const keyObj = {
          ...objKey,
          ...partialKey,
        } as CK
        const onFlushQueue = internalNode.isRunning(
          keysOrder.map((key) => keyObj[key]),
        )

        if (!onFlushQueue) {
          return ("getSignal$" in node ? node.getSignal$ : node.getState$)(
            keyObj,
          )
        }

        let observable: any = EMPTY_VALUE
        onFlushQueue.push(() => {
          try {
            observable = (
              "getSignal$" in node ? node.getSignal$ : node.getState$
            )(keyObj)
          } catch (e) {
            observable = e
          }
        })

        return new Observable((observer) => {
          if (observable !== EMPTY_VALUE) {
            if (observable instanceof Observable) {
              return observable.subscribe(observer)
            } else {
              observer.error(observable)
              return
            }
          }

          let subscription: Subscription | null = null
          onFlushQueue.push(() => {
            if (observable instanceof Observable) {
              subscription = observable.subscribe(observer)
            } else {
              observer.error(observable)
            }
          })

          return () => {
            subscription?.unsubscribe()
          }
        })
      }

      const onError = (err: any) => {
        const prevPromise = actualInstance.promise

        actualInstance.error = { e: err }
        actualInstance.subscription = null
        actualInstance.promise = null

        actualInstance.currentValue = EMPTY_VALUE

        runChildren(actualInstance, key, false)
        prevPromise?.rej(err)
        actualInstance.subject.error(err)
      }

      let observable: Observable<any> | null = null
      try {
        observable = getState$(ctxValue, ctxObservable, objKey)
      } catch (e) {
        onError(e)
      }

      actualInstance.subscription =
        observable?.subscribe({
          next(value) {
            let prevValue =
              previousValue !== EMPTY_VALUE
                ? previousValue
                : actualInstance.currentValue
            actualInstance.currentValue = value
            const prevPromise = actualInstance.promise
            actualInstance.promise = null
            if (prevValue === EMPTY_VALUE || !equalityFn(prevValue, value)) {
              prevPromise?.res(value)
              runChildren(actualInstance, key, true, true)
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
        runChildren(actualInstance, key, true, false)
        prevSubect?.complete()
      }

      previousValue = EMPTY_VALUE
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
    runChildren(instance, key, true, false)
    prevSubect?.complete()
  }

  addInternals(publicNode, privateNode)

  return privateNode
}

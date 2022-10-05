import { Observable, ReplaySubject, Subscription } from "rxjs"
import type { StateNode } from "./types"
import {
  EMPTY_VALUE,
  inactiveContext,
  invalidContext,
  StatePromise,
  DeferredPromise,
  createDeferredPromise,
} from "./internal"

const children = new WeakMap<
  StateNode<any>,
  Set<(isActive: boolean, value: any) => void>
>()

export const ctx = <V>(node: StateNode<V>): V => {
  const value = node.getValue()
  if (value instanceof StatePromise) throw invalidContext()
  return value
}
export type Ctx = typeof ctx

export const substate = <T, P>(
  parent: StateNode<P>,
  getState$: (ctx: Ctx) => Observable<T>,
  equalityFn: (a: T, b: T) => boolean,
): StateNode<T> => {
  let subject: ReplaySubject<T> | null = null
  let subscription: Subscription | null = null
  let currentValue: EMPTY_VALUE | T = EMPTY_VALUE
  let currentParentValue: EMPTY_VALUE | P = EMPTY_VALUE
  let promise: DeferredPromise<T> | null = null

  const result: StateNode<T> = {
    getValue: () => {
      if (!subject) throw inactiveContext()
      if (currentValue !== EMPTY_VALUE) return currentValue
      if (promise) return promise.promise
      promise = createDeferredPromise()
      return promise.promise
    },
    state$: () =>
      new Observable<T>((observer) => {
        if (subject) return subject.subscribe(observer)
        return observer.error(inactiveContext())
      }),
  }

  const childRunners = new Set<
    (isActive: boolean, value: T | EMPTY_VALUE) => void
  >()
  children.set(result, childRunners)

  const runChildren = (isActive: boolean, value: T | EMPTY_VALUE) => {
    childRunners.forEach((cb) => {
      cb(isActive, value)
    })
  }

  const run = (isActive: boolean, parentValue: any) => {
    if (!isActive) {
      const prevSubect = subject
      const prevPromise = promise
      subject = null
      promise = null

      subscription?.unsubscribe()
      subscription = null

      currentValue = EMPTY_VALUE
      currentParentValue = EMPTY_VALUE

      runChildren(false, EMPTY_VALUE)
      prevPromise?.rej(inactiveContext())
      prevSubect?.complete()
      return
    }

    if (parentValue !== EMPTY_VALUE) {
      // an actual change of context
      subscription?.unsubscribe()
      currentValue = EMPTY_VALUE
      currentParentValue = parentValue
      subject = subject || new ReplaySubject<T>(1)

      subscription = getState$(ctx).subscribe({
        next(value) {
          let prevValue = currentValue
          currentValue = value
          const prevPromise = promise
          promise = null
          if (prevValue === EMPTY_VALUE || !equalityFn(prevValue, value)) {
            prevPromise?.res(value)
            runChildren(true, value)
            subject!.next(value)
          }
        },
        error(err) {
          const prevPromise = promise
          const prevSubect = subject

          subscription?.unsubscribe()
          subscription = null
          promise = null
          subject = null

          currentValue = EMPTY_VALUE
          currentParentValue = EMPTY_VALUE

          runChildren(false, EMPTY_VALUE)
          prevPromise?.rej(err)
          prevSubect?.error(err)
        },
        complete() {
          subscription = null
        },
      })

      if (subscription.closed) subscription = null

      if (currentValue === EMPTY_VALUE && subject) {
        const prevSubect = subject
        subject = new ReplaySubject<T>(1)
        runChildren(true, EMPTY_VALUE)
        prevSubect.complete()
      }
      return
    }

    // at this point parentValue is EMPTY_VALUE
    if (currentParentValue === EMPTY_VALUE && subject) return

    const prevSubect = subject
    subject = new ReplaySubject<T>(1)

    subscription?.unsubscribe()
    subscription = null

    currentValue = EMPTY_VALUE
    currentParentValue = EMPTY_VALUE

    runChildren(true, EMPTY_VALUE)
    prevSubect?.complete()
  }

  children.get(parent)!.add(run)

  return result
}

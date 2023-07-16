import {
  Observable,
  Subject,
  Subscription,
  defer,
  filter,
  startWith,
} from "rxjs"
import type { KeysBaseType } from "../types"
import { EMPTY_VALUE } from "./empty-value"
import { StatePromise, createDeferredPromise } from "./promises"

// AKA StateObservable
export interface Instance<T, K> {
  key: K
  activate: () => void
  kill: () => void
  reset: () => void
  getValue: () => T | StatePromise<T>
  getState$: () => Observable<T>
}

export function createInstance<T, K extends KeysBaseType>(
  key: K,
  observable: Observable<T>,
  onAfterChange: () => void,
): Instance<T, K> {
  let currentValue: T | EMPTY_VALUE = EMPTY_VALUE
  let previousContextValue: T | EMPTY_VALUE = currentValue
  let subject = new Subject<T | EMPTY_VALUE>()
  // Needs to be deferred for the `startWith(currentValue)`
  let state$ = defer(
    () =>
      subject.pipe(
        startWith(currentValue),
        filter((v) => v !== EMPTY_VALUE),
      ) as Observable<T>,
  )

  const resetSubject = () => {
    previousContextValue = EMPTY_VALUE
    const oldSubject = subject
    subject = new Subject<T | EMPTY_VALUE>()
    state$ = defer(
      () =>
        subject.pipe(
          startWith(currentValue),
          filter((v) => v !== EMPTY_VALUE),
        ) as Observable<T>,
    )
    oldSubject.complete()
  }

  // TODO firehose
  let deferred = createDeferredPromise<T>()
  // Don't mark promise rejection as unhandled (???)
  deferred.promise.then(
    () => {},
    () => {},
  )
  let error = EMPTY_VALUE

  let subscription: Subscription | null = null
  const start = () => {
    let isSynchronous = true
    let emitted = false
    if (subscription) {
      const err = new Error("Instance already active")
      console.error(err)
      throw err
    }
    subscription = observable.subscribe({
      next: (v) => {
        currentValue = v

        // TODO equality function
        if (
          isSynchronous &&
          !emitted &&
          previousContextValue !== EMPTY_VALUE &&
          !Object.is(previousContextValue, v)
        ) {
          resetSubject()
        }
        emitted = true

        deferred.res(v)
        subject.next(v)
        onAfterChange()
      },
      error: (e) => {
        deferred.rej(e)
        error = e
        subject.error(e)
      },
      complete: () => {
        // TODO I thought this makes sense, but then a test fails!
        // I think the test is wrong, instead of EMPTY it should map to NEVER
        // I don't think leaving promises unfinished is something we wanted.
        // if (subject.getValue() === EMPTY_VALUE) {
        //   deferred.rej("TODO What kind of error? Test doesn't say")
        // }
      },
    })
    isSynchronous = false

    if (!emitted && previousContextValue !== EMPTY_VALUE) {
      resetSubject()
    }
  }

  const instance: Instance<T, K> = {
    key,
    activate() {
      // TODO just call it activate
      if (subscription) {
        return
      }

      start()
    },
    kill() {
      subscription?.unsubscribe()
      subscription = null
      subject.complete()
      if (currentValue === EMPTY_VALUE) {
        deferred.rej("TODO What kind of error? Test doesn't say")
      }
    },
    reset() {
      error = EMPTY_VALUE
      if (currentValue !== EMPTY_VALUE) {
        deferred = createDeferredPromise()
      }
      previousContextValue = currentValue
      currentValue = EMPTY_VALUE
      subscription?.unsubscribe()
      subscription = null
    },
    getValue() {
      if (error !== EMPTY_VALUE) {
        throw error
      }

      if (currentValue === EMPTY_VALUE) {
        return deferred.promise
      }
      return currentValue
    },
    getState$() {
      // In case someone tries to grab the state while we're switching context
      // we can't return the current subject because that might complete straight away
      // after the context switch, so we just swap it now.
      if (previousContextValue !== EMPTY_VALUE) {
        resetSubject()
      }

      return state$
    },
  }
  return instance
}

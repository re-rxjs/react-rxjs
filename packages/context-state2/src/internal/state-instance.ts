import { BehaviorSubject, Observable, Subscription, filter } from "rxjs"
import { EMPTY_VALUE } from "./empty-value"
import { StatePromise, createDeferredPromise } from "./promises"
import { KeysBaseType } from "./state-node"

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
): Instance<T, K> {
  let subject = new BehaviorSubject<T | EMPTY_VALUE>(EMPTY_VALUE)

  // TODO firehose
  let deferred = createDeferredPromise<T>()
  // Don't mark promise rejection as unhandled (???)
  deferred.promise.then(
    () => {},
    () => {},
  )
  let error = EMPTY_VALUE

  let subscription: Subscription | null = null
  const restart = () => {
    subscription?.unsubscribe()
    subscription = observable.subscribe({
      next: (v) => {
        deferred.res(v)
        subject.next(v)
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
  }

  const instance: Instance<T, K> = {
    key,
    activate() {
      if (subscription) {
        throw new Error("Instance already active")
      }

      restart()
    },
    kill() {
      subscription?.unsubscribe()
      subject.complete()
      if (subject.getValue() === EMPTY_VALUE) {
        deferred.rej("TODO What kind of error? Test doesn't say")
      }
    },
    reset() {
      if (error !== EMPTY_VALUE || subject.getValue() !== EMPTY_VALUE) {
        // If the new subscription returns the same value synchronously, do not complete the previous result.
        // TODO the child nodes should also reset... are they resetting?
        error = EMPTY_VALUE
        deferred = createDeferredPromise()
        subscription?.unsubscribe()
        let isSynchronous = true
        let passed = false
        subscription = observable.subscribe({
          next: (v) => {
            deferred.res(v)
            // TODO equality function
            if (isSynchronous && !Object.is(subject.getValue(), v)) {
              const oldSubject = subject
              subject = new BehaviorSubject<T | EMPTY_VALUE>(EMPTY_VALUE)
              oldSubject.complete()
            }
            passed = true
            subject.next(v)
          },
          error: (e) => {
            deferred.rej(e)
            error = e
            subject.error(e)
          },
        })
        isSynchronous = false

        if (!passed) {
          const oldSubject = subject
          subject = new BehaviorSubject<T | EMPTY_VALUE>(EMPTY_VALUE)
          oldSubject.complete()
        }
      }
      restart()
    },
    getValue() {
      if (error !== EMPTY_VALUE) {
        throw error
      }

      const value = subject.getValue()
      if (value === EMPTY_VALUE) {
        return deferred.promise
      }
      return value
    },
    getState$() {
      return subject.pipe(filter((v) => v !== EMPTY_VALUE)) as Observable<T>
    },
  }
  return instance
}

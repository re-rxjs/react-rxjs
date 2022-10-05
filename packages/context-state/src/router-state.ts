export {}
/*
import {
  combineLatest,
  map,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
} from "rxjs"

type GetContext = <R>(nodeState: InternalNodeState<R>) => R

interface InternalNodeState<T> {
  getValue: () => T | Promise<T>
  getContext: GetContext
  vote: () => () => void
  state$: Observable<T>
  context: Set<InternalNodeState<T>>
  recover: () => void
}

const EMPTY = Symbol("EMPTY")
type EMPTY = typeof EMPTY

export const createNode = <T>(
  source$: Observable<T>,
  parents: InternalNodeState<any>[],
  active$: (getContext: GetContext) => boolean,
) => {
  const getContext: any = () => {}

  let votes = 0
  let subject: Subject<T> | null = null
  let isActive: null | boolean = null

  let value: T | EMPTY
  let error: any = EMPTY
  let promise: null | {
    p: Promise<T>
    res: (value: T) => void
    rej: (e: any) => void
  } = null

  const state$ = new Observable<T>((observer) => {
    if (!subject) throw new Error()
    return subject.subscribe(observer)
  })

  const getValue = () => {
    if (error !== EMPTY) throw error
    if (value !== EMPTY) return value
    if (promise) return promise

    let res: any, rej: any
    const p = new Promise<T>((resolve, reject) => {
      res = (val: T) => {
        promise = null
        resolve(val)
      }
      rej = (e: any) => {
        promise = null
        reject(e)
      }
    })
    promise = { p, res, rej }
    return p
  }

  const isActive$: Observable<boolean | null> = combineLatest(
    parents.map((x) => x.state$),
  ).pipe(map(() => active$(getContext)))

  let stop = () => {}

  const tryStart = () => {
    if (votes < parents.length) return
    stop()

    let stopWasSyncCalled = false
    stop = () => {
      stopWasSyncCalled = true
    }

    let stateSubscription: null | Subscription = null
    const ctxSubscription = isActive$.subscribe({
      next: (newIsActive) => {
        stateSubscription?.unsubscribe()

        // we don't want to do this if the previous isActive was null
        if (isActive !== null) {
          const oldSubject = subject
          subject = new ReplaySubject(1)
          oldSubject?.complete()
        }

        value = EMPTY
        if (newIsActive) {
          stateSubscription = source$.subscribe({
            next(v) {
              value = v
              promise?.res(v)
              subject!.next(v)
            },
            complete() {
              promise?.rej(EMPTY)
              // We do not want to propagate the complete of the inner observable
              // subject!.complete()
            },
            error(e) {
              error = e
              value = EMPTY
              const oldSubject = subject
              subject = null
              promise?.rej(e)
              oldSubject!.error(e)
            },
          })
        } else if (newIsActive === false) {
          const oldSubject = subject
          subject = null
          promise?.rej(EMPTY)
          oldSubject?.error(EMPTY)
          stateSubscription = null
        }
        isActive = newIsActive
      },
      error(e) {
        error = e
        value = EMPTY
        const oldSubject = subject
        subject = null
        stateSubscription?.unsubscribe()
        promise?.rej(e)
        oldSubject?.error(e)
      },
    })

    stop = () => {
      stop = () => {}
      const oldSubject = subject
      subject = null
      stateSubscription?.unsubscribe()
      ctxSubscription.unsubscribe()
      promise?.rej(EMPTY)
      oldSubject?.complete()
    }

    if (stopWasSyncCalled) stop()
  }

  const vote = () => {
    votes++
    tryStart()
    return () => {
      votes--
      stop()
    }
  }

  return { vote, source$ }
}
*/

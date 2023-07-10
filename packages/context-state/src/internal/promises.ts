export class StatePromise<T> extends Promise<T> {}

export interface DeferredPromise<T> {
  promise: StatePromise<T>
  res: (value: T) => void
  rej: (err: any) => void
}

export const createDeferredPromise = <T>(): DeferredPromise<T> => {
  let res: (value: T) => void
  let rej: (err: any) => void
  const promise = new StatePromise<T>((resolve, reject) => {
    res = resolve
    rej = reject
  })

  return { promise, res: res!, rej: rej! }
}

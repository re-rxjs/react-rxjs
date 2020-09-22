import { Observable, Subject } from "rxjs"

const defaultMapper: any = () => {}

export function createListener<A extends unknown[], T>(
  mapper: (...args: A) => T,
): [Observable<T>, (...args: A) => void]
export function createListener(): [Observable<void>, () => void]

export function createListener<A extends unknown[], T>(
  mapper: (...args: A) => T = defaultMapper,
): [Observable<T>, (...args: A) => void] {
  const subject = new Subject<T>()
  return [subject.asObservable(), (...args: A) => subject.next(mapper(...args))]
}

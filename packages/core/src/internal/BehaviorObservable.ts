import { Observable } from "rxjs"

export interface BehaviorObservable<T> extends Observable<T> {
  getValue: () => any
}

export const enum Action {
  Error,
  Value,
  Suspense,
}

import { Observable } from "rxjs"

export interface BehaviorObservable<T> extends Observable<T> {
  getValue: () => T
}

import { Observable } from "rxjs"

export interface BehaviorObservable<T> extends Observable<T> {
  gV: () => T
}

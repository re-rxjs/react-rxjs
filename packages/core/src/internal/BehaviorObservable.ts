import { Observable, Subscription } from "rxjs"

export interface BehaviorObservable<T> extends Observable<T> {
  gV: (subscription?: Subscription) => T
  sB: (callback: () => void) => () => void
}

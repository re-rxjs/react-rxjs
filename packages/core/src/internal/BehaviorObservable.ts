import { Observable, Subscription } from "rxjs"
import { SUSPENSE } from "../SUSPENSE"

export interface BehaviorObservable<T> extends Observable<T> {
  gV: (subscription?: Subscription) => Exclude<T, typeof SUSPENSE>
}

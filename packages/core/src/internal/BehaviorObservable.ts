import { Observable } from "rxjs"
import { SUSPENSE } from "../SUSPENSE"

export interface BehaviorObservable<T> extends Observable<T> {
  getValue: () => T | typeof SUSPENSE
}

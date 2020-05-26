import { Observable } from "rxjs"
import { debounceTime } from "rxjs/operators"
import delayUnsubscription from "./delay-unsubscription"

const reactOptimizations = (delayTime: number) => <T>(
  source: Observable<T>,
): Observable<T> => source.pipe(delayUnsubscription(delayTime), debounceTime(0))

export default reactOptimizations

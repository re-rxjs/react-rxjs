import { Observable, defer } from "rxjs"
import { scan } from "rxjs/operators"

export const defaultStart = <T>(value: T) => (source$: Observable<T>) =>
  new Observable<T>((observer) => {
    let emitted = false
    const subscription = source$.subscribe(
      (x) => {
        emitted = true
        observer.next(x)
      },
      (e) => observer.error(e),
      () => observer.complete(),
    )

    if (!emitted) {
      observer.next(value)
    }

    return subscription
  })

export const scanWithDefaultValue = <I, O>(
  accumulator: (acc: O, current: I) => O,
  getSeed: () => O,
) => (source: Observable<I>) =>
  defer(() => {
    const seed = getSeed()
    return source.pipe(scan(accumulator, seed), defaultStart(seed))
  })

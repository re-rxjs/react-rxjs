import { Observable, Subject, GroupedObservable, BehaviorSubject } from "rxjs"
import { finalize, share } from "rxjs/operators"

const continuousGroupBy = <I, O>(mapper: (x: I) => O) => (
  stream: Observable<I>,
) =>
  new Observable<GroupedObservable<O, I>>((subscriber) => {
    const groups: Map<O, Subject<I>> = new Map()

    return stream.subscribe(
      (x) => {
        const key = mapper(x)
        if (groups.has(key)) {
          return groups.get(key)!.next(x)
        }

        const subject = new BehaviorSubject<I>(x)
        groups.set(key, subject)

        const res = subject.pipe(
          finalize(() => groups.delete(key)),
          share(),
        ) as GroupedObservable<O, I>
        res.key = key

        subscriber.next(res)
      },
      (e) => {
        subscriber.error(e)
        /* istanbul ignore next */
        groups.forEach((g) => g.error(e))
      },
      () => {
        subscriber.complete()
        /* istanbul ignore next */
        groups.forEach((g) => g.complete())
      },
    )
  })

export default continuousGroupBy

import { merge, Observable, ObservableInput, from, SchedulerLike } from "rxjs"
import { map } from "rxjs/operators"

export const mergeWithKey: <
  O extends { [P in keyof any]: ObservableInput<any> },
  OT extends {
    [K in keyof O]: O[K] extends ObservableInput<infer V>
      ? { type: K; payload: V }
      : unknown
  }
>(
  x: O,
  concurrent?: number,
  scheduler?: SchedulerLike,
) => Observable<OT[keyof O]> = (input, ...optionalArgs) =>
  merge(
    ...(Object.entries(input)
      .map(
        ([type, stream]) =>
          from(stream).pipe(map(payload => ({ type, payload } as any))) as any,
      )
      .concat(optionalArgs) as any[]),
  )

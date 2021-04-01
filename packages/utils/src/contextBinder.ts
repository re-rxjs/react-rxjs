import { Observable } from "rxjs"
import { bind } from "@react-rxjs/core"
import type { SubstractTuples } from "./internal-utils"

const execSelf = <T>(fn: () => T) => fn()

/**
 * Returns a version of bind where its hook will have the first parameters bound
 * the results of the provided functions
 *
 * @param {...React.Context} context - The React.Context that should be bound to the hook.
 */
export function contextBinder<
  A extends (() => any)[],
  OT extends {
    [K in keyof A]: A[K] extends () => infer V ? V : unknown
  }
>(
  ...args: A
): <AA extends any[], T, ARGS extends [...OT, ...AA]>(
  getObservable: (...args: ARGS) => Observable<T>,
  defaultValue?: T | undefined,
) => [
  (...args: SubstractTuples<ARGS, OT>) => T,
  (...args: ARGS) => Observable<T>,
]
export function contextBinder(...args: any[]) {
  const useArgs = () => args.map(execSelf)
  return function () {
    const [hook, getter] = bind.apply(null, arguments as any) as any
    return [(...args: any[]) => (hook as any)(...useArgs(), ...args), getter]
  } as any
}

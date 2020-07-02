import { takeWhile } from "rxjs/operators"
import { COMPLETE } from "./COMPLETE"

const isActive = <T>(x: T) => x !== (COMPLETE as any)
export const takeUntilComplete = takeWhile(isActive)

import { useLayoutEffect } from "react"
import { noop } from "rxjs"

const isSSR = process.env.IS_SSR
// istanbul ignore next
export default (isSSR ? noop : useLayoutEffect) as typeof useLayoutEffect

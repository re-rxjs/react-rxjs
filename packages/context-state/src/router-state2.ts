export {}
/*
import { EMPTY_VALUE } from "internal/empty-value"
import { Observable, of } from "rxjs"
import { StateNode, StateNodeFn, StringRecord } from "./types"

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

type CtxFromGrandpas<
  Parents extends StringRecord<StateNode<any, any, any, any>>,
> = Parents extends StringRecord<StateNode<any, any, infer CTX, any>>
  ? UnionToIntersection<CTX>
  : unknown

type CtxFromParents<
  Parents extends StringRecord<StateNode<any, any, any, any>>,
> = {
  [K in keyof Parents as Parents[K] extends StateNode<infer Id, any, any, any>
    ? Id
    : never]: Parents[K] extends StateNode<any, infer T, any, any>
    ? () => T
    : never
}

type CtxSelectorFromParents<
  Parents extends StringRecord<StateNode<any, any, any, any>>,
> = {
  [K in keyof Parents as Parents[K] extends StateNode<
    infer Id,
    any,
    any,
    infer K
  >
    ? void extends K
      ? never
      : Id
    : never]: Parents[K] extends StateNode<any, any, any, infer K>
    ? K | StringRecord<K> | Array<K>
    : never
}
*/

/*
type Test = CtxFromParents<{
  parentFoo: StateNode<'foo', 'fooT', any, number>
  parentBar: StateNode<'bar', number, any, string>
  parentBaz: StateNode<'baz', bigint, any>
}>
*/
/*

type CtxInstances<Parents extends StringRecord<StateNode<any, any, any, any>>> =
  {
    [K in keyof Parents as Parents[K] extends StateNode<infer Id, any, any, any>
      ? Id
      : never]: Parents[K] extends StateNode<any, infer T, any, infer Key>
      ? void extends Key
        ? { getValue: () => T | EMPTY_VALUE }
        : {
            getActiveInstances: () => Map<Key, T>
            getLoadingInstances: () => Array<Key>
          }
      : never
  }

type SelectorResult<
  Parents extends StringRecord<StateNode<any, any, any, any>>,
  K extends string | number | bigint | Symbol | void,
> = void extends K
  ? CtxSelectorFromParents<Parents> | null
  : Array<{
      key: K
      ctx: CtxSelectorFromParents<Parents>
    }>

export const createStateNode = <
  ID extends string,
  Parents extends StringRecord<StateNode<any, any, any, any>>,
  T,
  K extends string | number | bigint | Symbol | void = void,
>(
  id: ID,
  parents: Parents,
  selector: (
    ctx: CtxFromGrandpas<Parents>,
    parents: CtxInstances<Parents>,
    current: SelectorResult<Parents, K>,
  ) => SelectorResult<Parents, K>,
  source$: StateNodeFn<
    K,
    Observable<T>,
    [ctx: CtxFromGrandpas<Parents>, idx: number]
  >,
): StateNode<ID, T, CtxFromGrandpas<Parents>, K> => {
  return {
    id,
    parents,
    selector,
    source$,
  } as any
}

const parentFoo: StateNode<"foo", "fooT", {}, number> = null as any
const parentBar: StateNode<"bar", number, {}, string> = null as any
const parentBaz: StateNode<"baz", bigint, {}, void> = null as any

export const result = createStateNode(
  "fooasdf",
  {
    parentFoo,
    parentBar,
    parentBaz,
  },
  () => [
    { key: "sd", ctx: { foo: 3, bar: "3" } },
    { key: "sd2", ctx: { foo: [1, 2], bar: "3" } },
  ],
  (x) => new Observable<string>((observer) => observer.next(x)),
)
*/

/*
const root = createStateNode('root', {}, () => of(5 as const), () => {})
root.getCurrentValue()

type Root = StateNode<string, {}>
type Network = StateNode<{networkId: string}, {}>
type Positions = StateNode<
  {positionId: number},
  {network: () => {networkId: string}}
  , number
>
type PositionsToCompare = StateNode<
  [number, number],
  {network: () => {networkId: string}}
>

type ComparedPositions = StateNode<
  {positionId: number},
  {
    network: () => {networkId: string},
    positionsToCompare: () => [number, number],
    positions: () => {positionId: number},
  },
  'best' | 'worst'
>

type BestWorstDiff = StateNode<
  {positionId: number, diff: number, other: string},
  {
    network: () => {networkId: string},
    positionsToCompare: () => [number, number],
    best: () => {positionId: number},
    worst: () => {positionId: number},
  }

>

let root: Root = {} as any
let network: Network = {} as any

let positions: Positions = {} as any
let positionToCompare: PositionsToCompare = {} as any

const comparedPositions: ComparedPositions = createStateNode(
  {positionToCompare, positions},
  (key: 'best' | 'worst', ctx) => of(ctx.positions()),
  () => {
    return [{
      key: 'best',
      ctx: {
        positions: 2,
      }
    }, {
      key: 'worst',
      ctx: {
        positions: 1,
      }
    }]
  }
)

export const BestWorstDiff = createStateNode(
  {comparedPositions},
  () => new Observable<bigint>(observer => observer.next(5n)),
  () => {
    return {
      ctx: {
        best: 'best',
        wost: 'worst'
      }
    }
  },
)
*/

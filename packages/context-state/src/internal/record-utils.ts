type RecordKeys = <K extends string | number>(o: Record<K, any>) => K[]
export const recordKeys: RecordKeys = Object.keys

type RecordEntries = <K extends string | number, T>(o: Record<K, T>) => [K, T][]
export const recordEntries: RecordEntries = Object.entries

type RecordFromEntries = <K extends string | number, T>(
  input: [K, T][],
) => Record<K, T>
export const recordFromEntries: RecordFromEntries = Object.fromEntries

export const mapRecord = <K extends string | number, T, TT>(
  data: Record<K, T>,
  mapper: (x: T, i: K, o: Record<K, T>) => TT,
): Record<K, TT> =>
  recordFromEntries(
    recordEntries(data).map(([k, v]) => [k, mapper(v, k, data)]),
  )

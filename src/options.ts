export interface StaticObservableOptions<T> {
  unsubscribeGraceTime?: number
  compare?: (a: T, b: T) => boolean
}
export const defaultStaticOptions = {
  unsubscribeGraceTime: 200,
  compare: (a: any, b: any) => a === b,
}

export interface FactoryObservableOptions<T>
  extends StaticObservableOptions<T> {
  suspenseTime?: number
}

export const defaultFactoryOptions = {
  ...defaultStaticOptions,
  suspenseTime: 200,
}

export type ObservableOptions = Omit<FactoryObservableOptions<any>, "compare">

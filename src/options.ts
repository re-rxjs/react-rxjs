export interface ConnectorOptions<T> {
  unsubscribeGraceTime?: number
  compare?: (a: T, b: T) => boolean
}
export const defaultConnectorOptions = {
  unsubscribeGraceTime: 200,
  compare: Object.is,
}

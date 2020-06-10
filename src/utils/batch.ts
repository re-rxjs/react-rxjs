function defaultNoopBatch(callback: () => void) {
  callback()
}

let batch = defaultNoopBatch

export const setBatch = (newBatch: () => void) => (batch = newBatch)
export const getBatch = () => batch

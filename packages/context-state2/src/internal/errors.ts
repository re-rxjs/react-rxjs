export class InactiveContextError extends Error {
  constructor() {
    super("Inactive Context")
    this.name = "InactiveContextError"
  }
}

export class InvalidContext extends Error {
  constructor() {
    super("Invalid Context")
    this.name = "InvalidContext"
  }
}

export const inactiveContext = () => new InactiveContextError()
export const invalidContext = () => new InvalidContext()

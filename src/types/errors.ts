/** Thrown by stubs. `replacedBy` names the plan row, phase or lane that implements it. */
export class NotImplementedError extends Error {
  override readonly name = 'NotImplementedError';

  constructor(
    readonly what: string,
    readonly replacedBy: string,
  ) {
    super(`${what} is not implemented yet (${replacedBy})`);
  }
}

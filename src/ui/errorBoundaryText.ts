/** The line `ErrorBoundary` shows for whatever was thrown: `Name: message` for an `Error`, else its string. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message ? `${error.name}: ${error.message}` : error.name;
  return String(error);
}

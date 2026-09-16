export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function wrapExternal(code: string, err: unknown): AppError {
  const message = err instanceof Error ? err.message : String(err);
  return new AppError(code, message, err);
}

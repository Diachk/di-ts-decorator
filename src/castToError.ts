/**
 * LINKURIOUS CONFIDENTIAL
 * Copyright Linkurious SAS 2012 - 2022
 *
 * Created on 2022-01-11
 */

/**
 * Return input value if it is a proper `Error`, or wrap it into an `Error` otherwise.
 *
 * We try all the strategies we know of in order of likelihood and compute cost so that this
 * function stays fairly cheap:
 * 1. Check if input is an Error instance
 * 2. Check if input is a string
 * 3. Check if input implements the Error interface with duck-typing
 * 4. Stringify input
 */
export function castToError(throwable: unknown): Error {
  if (throwable instanceof Error) {
    return throwable;
  }

  if (typeof throwable === 'string') {
    return new Error(throwable);
  }

  if (throwable && typeof throwable === 'object') {
    const error = throwable as Error;
    const hasMessage = typeof error.message === 'string';
    const hasName = typeof error.name === 'string';
    const hasOptionalStack = error.stack === undefined || typeof error.stack === 'string';
    if (hasMessage && hasName && hasOptionalStack) {
      return error;
    }

    if (hasMessage) {
      return new Error(error.message);
    }
  }

  return new Error(`Unknown error: ${castToString(throwable)}`);
}

function castToString(throwable: unknown): string {
  // JSON.stringify can fail (notably in case of circular references), hence the try-catch.
  try {
    return JSON.stringify(throwable);
  } catch {
    return String(throwable);
  }
}

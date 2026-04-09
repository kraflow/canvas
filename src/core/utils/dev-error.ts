import { IS_DEV } from '../constants'

/**
 * Throws an error with a descriptive message in development.
 * In production, throws a minimal error or skips the check where safe.
 *
 * Use this for errors that indicate programming mistakes (assertions)
 * rather than runtime failures that need handling.
 */
export function devThrow(message: string): never {
  if (IS_DEV) {
    throw new Error(message)
  } else {
    // In production, throw a minimal error to avoid including error strings
    throw new Error()
  }
}

/**
 * Asserts a condition is true, throwing in development with a message.
 * In production, throws a minimal error if the assertion fails.
 */
export function devAssert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    devThrow(message)
  }
}

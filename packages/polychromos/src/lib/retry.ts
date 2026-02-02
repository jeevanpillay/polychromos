export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Wraps an async function with retry logic using exponential backoff.
 * Does not retry on auth/permission errors or version conflicts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on auth/permission errors or version conflicts
      if (
        lastError.message.includes("Unauthenticated") ||
        lastError.message.includes("Access denied") ||
        lastError.message.includes("Version conflict")
      ) {
        throw lastError;
      }

      if (attempt < maxAttempts) {
        const delay = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1),
          maxDelayMs,
        );
        console.warn(
          `⚠ Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // This should never happen since maxAttempts >= 1, but TypeScript needs this
  throw lastError ?? new Error("Unknown retry error");
}

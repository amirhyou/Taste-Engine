interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
}

function isTransientError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message;
    // Network failure
    if (msg.includes('Network request failed')) return true;
    // HTTP 5xx or 429 (rate limit)
    if (/Social API (5\d\d|429):/.test(msg)) return true;
    return false;
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options?: RetryOptions,
): Promise<T> {
    const maxRetries = options?.maxRetries ?? 5;
    const baseDelay = options?.baseDelay ?? 1000;
    const maxDelay = options?.maxDelay ?? 60000;

    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (!isTransientError(error)) {
                throw error;
            }
            if (attempt === maxRetries - 1) break;
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay) + Math.random() * 1000;
            await new Promise<void>(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

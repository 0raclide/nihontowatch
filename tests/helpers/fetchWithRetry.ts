/**
 * Fetch wrapper with exponential backoff for 429 (rate limit) responses.
 * Used by live API integration tests that hit production endpoints.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  { maxRetries = 3, baseDelayMs = 1000 } = {}
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }

    // Use Retry-After header if present, otherwise exponential backoff
    const retryAfter = response.headers.get('Retry-After');
    const delayMs = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : baseDelayMs * 2 ** attempt;

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  // Unreachable, but TypeScript needs it
  throw new Error('fetchWithRetry: exhausted retries');
}

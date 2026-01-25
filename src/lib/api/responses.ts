/**
 * Standardized API Response Helpers
 *
 * Provides consistent response formats across all API routes.
 * All error responses follow the same structure for easier client-side handling.
 *
 * Usage:
 *   import { apiError, apiSuccess, apiUnauthorized } from '@/lib/api/responses';
 *
 *   // Error responses
 *   return apiError('Invalid input', 400);
 *   return apiUnauthorized();
 *   return apiForbidden('Subscription required');
 *   return apiNotFound('Listing');
 *
 *   // Success responses
 *   return apiSuccess({ data: results });
 *   return apiSuccess({ items: [], total: 0 }, { cache: 'public, max-age=3600' });
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Standard error response structure
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Response options for customizing headers
 */
export interface ResponseOptions {
  cache?: string;
  headers?: Record<string, string>;
}

/**
 * Create a standardized error response
 *
 * @param message - Human-readable error message
 * @param status - HTTP status code (default: 500)
 * @param options - Additional options like error code or details
 */
export function apiError(
  message: string,
  status: number = 500,
  options?: { code?: string; details?: Record<string, unknown>; log?: boolean }
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = { error: message };

  if (options?.code) {
    response.code = options.code;
  }

  if (options?.details) {
    response.details = options.details;
  }

  // Log server errors by default
  if (options?.log !== false && status >= 500) {
    logger.error(`API Error [${status}]: ${message}`, options?.details);
  }

  return NextResponse.json(response, { status });
}

/**
 * 400 Bad Request - Invalid input or parameters
 */
export function apiBadRequest(
  message: string = 'Bad request',
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return apiError(message, 400, { code: 'BAD_REQUEST', details, log: false });
}

/**
 * 401 Unauthorized - Authentication required
 */
export function apiUnauthorized(
  message: string = 'Unauthorized'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 401, { code: 'UNAUTHORIZED', log: false });
}

/**
 * 403 Forbidden - Insufficient permissions or subscription tier
 */
export function apiForbidden(
  message: string = 'Forbidden'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 403, { code: 'FORBIDDEN', log: false });
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export function apiNotFound(
  resource: string = 'Resource'
): NextResponse<ApiErrorResponse> {
  return apiError(`${resource} not found`, 404, { code: 'NOT_FOUND', log: false });
}

/**
 * 405 Method Not Allowed
 */
export function apiMethodNotAllowed(
  allowed: string[]
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    {
      status: 405,
      headers: { Allow: allowed.join(', ') },
    }
  );
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export function apiConflict(
  message: string = 'Conflict'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 409, { code: 'CONFLICT', log: false });
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export function apiRateLimited(
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const response = NextResponse.json(
    { error: 'Too many requests', code: 'RATE_LIMITED' },
    { status: 429 }
  );

  if (retryAfter) {
    response.headers.set('Retry-After', String(retryAfter));
  }

  return response;
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export function apiServerError(
  message: string = 'Internal server error',
  error?: unknown
): NextResponse<ApiErrorResponse> {
  if (error) {
    logger.logError(message, error);
  }
  return apiError(message, 500, { code: 'INTERNAL_ERROR' });
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export function apiServiceUnavailable(
  message: string = 'Service temporarily unavailable'
): NextResponse<ApiErrorResponse> {
  return apiError(message, 503, { code: 'SERVICE_UNAVAILABLE' });
}

/**
 * Create a standardized success response
 *
 * @param data - Response payload
 * @param options - Response options (caching, headers)
 */
export function apiSuccess<T>(
  data: T,
  options?: ResponseOptions
): NextResponse<T> {
  const response = NextResponse.json(data);

  if (options?.cache) {
    response.headers.set('Cache-Control', options.cache);
  }

  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Database error helper - logs and returns appropriate response
 */
export function apiDatabaseError(
  operation: string,
  error: unknown
): NextResponse<ApiErrorResponse> {
  logger.logError(`Database error during ${operation}`, error);
  return apiError('Database error', 500, { code: 'DATABASE_ERROR' });
}

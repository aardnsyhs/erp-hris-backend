/**
 * Refresh Token Short-Term Mitigation Constants (P0-C)
 *
 * Configures the bounded lookup query and retention windows to prevent
 * libuv worker thread saturation and unbounded database table growth.
 */

/**
 * Retention window (in days) for revoked refresh tokens to detect reuse attacks.
 * Revoked tokens within this window are retained in candidate queries so that any
 * attempt to reuse a recently rotated token will be caught and trigger session revocation.
 *
 * Design rationale: Matches standard JWT_REFRESH_EXPIRATION of 7 days ('7d').
 * Tokens older than 7 days have already expired at the cryptographic JWT signature layer.
 */
export const DEFAULT_REFRESH_TOKEN_REUSE_RETENTION_DAYS = 7;

/**
 * Maximum candidate refresh tokens fetched per user during rotation and logout.
 * Bounding this query guarantees that asynchronous `bcrypt.compare` calls (which execute
 * on libuv worker threads) are capped at a conservative upper limit, preventing
 * thread pool starvation and severe request latency spikes.
 *
 * Design rationale: In an internal HRIS, legitimate users rarely possess more than 5-10
 * active sessions across devices. A cap of 20 accommodates heavy multi-device usage while
 * bounding maximum verification latency.
 */
export const DEFAULT_REFRESH_TOKEN_QUERY_LIMIT = 20;

/**
 * Retention window (in days) before a revoked refresh token is eligible for permanent purge.
 * Provides an ample 30-day window for forensic auditing before hard deletion.
 */
export const DEFAULT_REFRESH_TOKEN_PURGE_RETENTION_DAYS = 30;

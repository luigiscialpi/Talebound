import { jwtVerify, decodeJwt, createRemoteJWKSet, type JWTPayload } from "jose";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

// Cache the JWKS remote keystore globally to prevent refetching keys on every request.
let jwksInstance: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksInstance(supabaseUrl: string) {
  if (!jwksInstance) {
    jwksInstance = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwksInstance;
}

/**
 * Shape of the JWT claims issued by Supabase.
 * "sub" is the user UUID; "role" distinguishes anon vs authenticated users.
 */
interface SupabaseJwtClaims extends JWTPayload {
  sub: string;
  role?: string;
  email?: string;
}

/**
 * Augment Express Request so downstream handlers can read req.user safely.
 * Using module augmentation avoids casting throughout the codebase.
 */
declare module "express-serve-static-core" {
  interface Request {
    user?: SupabaseJwtClaims;
  }
}

/**
 * Extract the raw Bearer token from the Authorization header.
 * Returns undefined when the header is missing or malformed.
 */
function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return undefined;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

/**
 * JWT authentication middleware (doc §7 - Auth & JWT).
 *
 * Behaviour:
 *  - When SUPABASE_JWT_SECRET is set: verifies the HS256 signature locally
 *    (no network round-trip). Returns 401 on missing/invalid token.
 *  - When SUPABASE_JWT_SECRET is absent (local dev): decodes without
 *    verification and attaches claims to req.user (bypass mode).
 *    Logs a warning so developers are aware of the degraded security.
 *
 * In both modes, req.user.sub contains the authenticated userId.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);

  // --- Bypass mode (no secret configured) ---
  if (!config.SUPABASE_JWT_SECRET) {
    console.warn(
      "[auth] SUPABASE_JWT_SECRET not set -> JWT verification bypassed (dev mode only)",
    );
    if (token) {
      try {
        const claims = decodeJwt(token) as SupabaseJwtClaims;
        req.user = claims;
      } catch {
        // Malformed token: attach nothing, let the route decide.
      }
    }
    next();
    return;
  }

  // --- Strict mode (secret is configured) ---
  if (!token) {
    logger.warn({ event: "auth_failed", reason: "missing_token", headers: req.headers }, "Authentication failed: missing token");
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing Bearer token" });
    return;
  }

  try {
    let payload: JWTPayload;

    // Parse the token header to determine the algorithm
    const parts = token.split(".");
    if (!parts[0]) {
      throw new Error("Malformed token structure");
    }
    const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf-8"));

    if (header.alg === "ES256") {
      if (!config.SUPABASE_URL) {
        throw new Error("SUPABASE_URL is required to verify ES256 tokens via JWKS");
      }
      const JWKS = getJwksInstance(config.SUPABASE_URL);
      const result = await jwtVerify(token, JWKS, {
        algorithms: ["ES256"],
      });
      payload = result.payload;
    } else {
      // Default to HS256 local verification
      if (!config.SUPABASE_JWT_SECRET) {
        throw new Error("SUPABASE_JWT_SECRET is not configured for HS256 verification");
      }
      const secret = new TextEncoder().encode(config.SUPABASE_JWT_SECRET);
      const result = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
      });
      payload = result.payload;
    }

    req.user = payload as SupabaseJwtClaims;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    let tokenHeader: any = null;
    try {
      const parts = token.split(".");
      if (parts[0]) {
        tokenHeader = JSON.parse(Buffer.from(parts[0], "base64").toString("utf-8"));
      }
    } catch {}
    logger.warn({ event: "auth_failed", reason: "invalid_token", error: message, tokenHeader }, `Authentication failed: ${message}`);
    res.status(401).json({ error: "UNAUTHORIZED", message });
  }
}

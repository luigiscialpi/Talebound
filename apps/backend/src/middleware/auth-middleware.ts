import { jwtVerify, decodeJwt, type JWTPayload } from "jose";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

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
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing Bearer token" });
    return;
  }

  try {
    const secret = new TextEncoder().encode(config.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    req.user = payload as SupabaseJwtClaims;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    res.status(401).json({ error: "UNAUTHORIZED", message });
  }
}

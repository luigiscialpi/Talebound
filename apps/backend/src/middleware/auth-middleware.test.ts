import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = "test-secret-that-is-at-least-32-bytes-long";
const TEST_USER_ID = "user-uuid-1234";

/** Mint a valid HS256 JWT signed with TEST_SECRET. */
async function mintJwt(
  overrides: Partial<{ sub: string; role: string; exp: number }> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: overrides.sub ?? TEST_USER_ID,
    role: overrides.role ?? "authenticated",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(overrides.exp ?? now + 3600)
    .sign(new TextEncoder().encode(TEST_SECRET));
}

/** Build a minimal Express-compatible mock request. */
function makeReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  } as unknown as Request;
}

/** Capture status/body written by the middleware via res.status().json(). */
function makeRes(): {
  res: Response;
  statusCode: () => number | null;
  body: () => unknown;
} {
  let capturedStatus: number | null = null;
  let capturedBody: unknown = null;

  const res = {
    status(code: number) {
      capturedStatus = code;
      return {
        json(b: unknown) {
          capturedBody = b;
        },
      };
    },
  } as unknown as Response;

  return {
    res,
    statusCode: () => capturedStatus,
    body: () => capturedBody,
  };
}

// ---------------------------------------------------------------------------
// Module under test - imported once, env set before first import.
// ---------------------------------------------------------------------------

let authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;

before(async () => {
  process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  // Satisfy config.ts required env vars.
  process.env.PORT = "3001";
  process.env.HMAC_SECRET = "dev-only-secret-change-me-32characters";
  const mod = await import("./auth-middleware.js");
  authMiddleware = mod.authMiddleware;
});

after(() => {
  delete process.env.SUPABASE_JWT_SECRET;
  delete process.env.PORT;
  delete process.env.HMAC_SECRET;
});

// ---------------------------------------------------------------------------
// Tests - strict mode (SUPABASE_JWT_SECRET is set)
// ---------------------------------------------------------------------------

test("strict mode: missing Authorization header -> 401", async () => {
  const req = makeReq();
  const { res, statusCode } = makeRes();
  let nextCalled = false;
  await authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false, "next() must not be called");
  assert.equal(statusCode(), 401);
});

test("strict mode: valid token -> req.user populated and next() called", async () => {
  const token = await mintJwt();
  const req = makeReq(`Bearer ${token}`);
  const { res } = makeRes();
  let nextCalled = false;
  await authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true, "next() must be called");
  assert.equal((req as { user?: { sub: string } }).user?.sub, TEST_USER_ID);
});

test("strict mode: expired token -> 401", async () => {
  const token = await mintJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
  const req = makeReq(`Bearer ${token}`);
  const { res, statusCode } = makeRes();
  let nextCalled = false;
  await authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(statusCode(), 401);
});

test("strict mode: tampered signature -> 401", async () => {
  const token = await mintJwt();
  // Flip the last char to break the signature.
  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  const req = makeReq(`Bearer ${tampered}`);
  const { res, statusCode } = makeRes();
  let nextCalled = false;
  await authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(statusCode(), 401);
});

test("strict mode: non-Bearer Authorization header -> 401", async () => {
  const req = makeReq("Token some-api-key");
  const { res, statusCode } = makeRes();
  let nextCalled = false;
  await authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(statusCode(), 401);
});

test("strict mode: error body contains UNAUTHORIZED key", async () => {
  const req = makeReq();
  const { res, body } = makeRes();
  await authMiddleware(req, res, () => {});
  assert.equal((body() as Record<string, unknown>)?.error, "UNAUTHORIZED");
});

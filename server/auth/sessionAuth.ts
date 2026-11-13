import crypto from 'crypto';
import express from 'express';
import {
  formatDbError,
  isDbUnavailableError,
  prisma,
  withDbRetry,
} from '../db/prisma';
import { ensureWorkspaceBootstrap } from '../db/initEngine';
import {
  evaluateEffectiveCapabilities,
  type EvaluatedCapabilities,
  hasActionCapability,
  hasModuleCapability,
} from './policy';

export const SESSION_COOKIE_NAME = 'ws_session';
export const SESSION_HEADER_NAME = 'x-workspace-session';
export const SESSION_RESPONSE_HEADER = 'X-Workspace-Session-Token';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days persistent session

export interface AuthenticatedUserContext {
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    role: string;
    memberTheme: string;
    memberId: string | null;
    permissionVersion: number;
    storageQuotaBytes: number;
    maxFileSizeBytes: number;
    usedStorageBytes: number;
    avatarUrl: string | null;
    isActive: boolean;
  };
  sessionId: string;
  capabilities: EvaluatedCapabilities;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUserContext | null;
      dbError?: any;
    }
  }
}

export function hashTokenSha256(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = val;
  }
  return out;
}

function isHttpsRequest(req: express.Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '');
  return Boolean(req.secure || proto.includes('https'));
}

function serializeCookie(
  name: string,
  value: string,
  opts: { maxAgeSec?: number; secure?: boolean }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    opts.secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (typeof opts.maxAgeSec === 'number') {
    parts.push(`Max-Age=${opts.maxAgeSec}`);
  }
  if (opts.secure) {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  return parts.join('; ');
}

export async function createSessionForUser(
  userId: string,
  req: express.Request,
  res: express.Response
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashTokenSha256(rawToken);
  const nowMs = Date.now();
  const expiresMs = nowMs + SESSION_TTL_MS;
  const nowStr = new Date(nowMs).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  await prisma.$transaction(async (tx) => {
    await tx.workspaceSession.create({
      data: {
        id: `sess-${nowMs.toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
        userId,
        tokenHash,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 240) || null,
        ipAddress: String(req.ip || req.socket.remoteAddress || '').slice(0, 120) || null,
        expiresAt: BigInt(expiresMs),
        lastSeenAt: BigInt(nowMs),
        createdAt: nowStr,
      },
    });
    await tx.workspaceUser.update({
      where: { id: userId },
      data: { lastLoginAt: nowStr },
    });
  });

  const secure = isHttpsRequest(req);
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, rawToken, {
      maxAgeSec: Math.floor(SESSION_TTL_MS / 1000),
      secure,
    })
  );
  res.setHeader(SESSION_RESPONSE_HEADER, rawToken);
  return rawToken;
}

export function clearSessionCookie(req: express.Request, res: express.Response) {
  const secure = isHttpsRequest(req);
  res.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, '', { maxAgeSec: 0, secure })
  );
  res.setHeader(SESSION_RESPONSE_HEADER, '');
}

export async function getUserUsedStorageBytes(userId: string): Promise<number> {
  const agg = await prisma.workspaceFile.aggregate({
    where: { ownerUserId: userId },
    _sum: { compressedSizeBytes: true },
  });
  return Number(agg._sum.compressedSizeBytes || BigInt(0));
}

export function extractSessionTokenFromRequest(req: express.Request): string | null {
  const headerToken = req.headers[SESSION_HEADER_NAME];
  if (typeof headerToken === 'string' && headerToken.trim().length > 16) {
    return headerToken.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 16) return bearer;
  }
  const cookies = parseCookieHeader(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  const queryToken = req.query?.ws_token;
  if (typeof queryToken === 'string' && queryToken.trim().length > 16) {
    return queryToken.trim();
  }
  return null;
}

async function buildAuthenticatedContext(
  user: any,
  sessionId: string
): Promise<AuthenticatedUserContext> {
  const usedStorageBytes = await getUserUsedStorageBytes(user.id);
  const capabilities = evaluateEffectiveCapabilities(
    user,
    user.accessPolicy,
    user.projectGrants
  );

  return {
    sessionId,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: capabilities.role,
      memberTheme: user.memberTheme || 'cloud',
      memberId: user.memberId || null,
      permissionVersion: user.permissionVersion || 1,
      storageQuotaBytes: Number(user.storageQuotaBytes || 524288000),
      maxFileSizeBytes: Number(user.maxFileSizeBytes || 26214400),
      usedStorageBytes,
      avatarUrl: user.avatarUrl || null,
      isActive: user.isActive !== false,
    },
    capabilities,
  };
}

export async function resolveAuthFromRequest(
  req: express.Request
): Promise<AuthenticatedUserContext | null> {
  const rawToken = extractSessionTokenFromRequest(req);
  if (!rawToken) return null;

  const tokenHash = hashTokenSha256(rawToken);
  const session = await prisma.workspaceSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          accessPolicy: true,
          projectGrants: true,
        },
      },
    },
  });

  if (
    session &&
    !session.revokedAt &&
    Number(session.expiresAt) >= Date.now() &&
    session.user &&
    session.user.isActive
  ) {
    if (Date.now() - Number(session.lastSeenAt) > 60_000) {
      prisma.workspaceSession
        .update({
          where: { id: session.id },
          data: { lastSeenAt: BigInt(Date.now()) },
        })
        .catch(() => {});
    }
    return buildAuthenticatedContext(session.user, session.id);
  }

  return null;
}

export async function attachAuthContext(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
) {
  try {
    await withDbRetry(async () => {
      await ensureWorkspaceBootstrap();
      req.auth = await resolveAuthFromRequest(req);
    });
    req.dbError = undefined;
  } catch (err: any) {
    req.auth = null;
    if (isDbUnavailableError(err)) {
      req.dbError = err;
    }
  }

  next();
}

export function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.dbError) {
    res.status(503).json({
      ok: false,
      error: formatDbError(req.dbError),
      code: 'DB_UNAVAILABLE',
    });
    return;
  }
  if (!req.auth) {
    res.status(401).json({
      ok: false,
      error: 'Authentication required. Please sign in.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  next();
}

export function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.dbError) {
    res.status(503).json({
      ok: false,
      error: formatDbError(req.dbError),
      code: 'DB_UNAVAILABLE',
    });
    return;
  }
  if (!req.auth) {
    res.status(401).json({
      ok: false,
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }
  if (!req.auth.capabilities.isAdmin) {
    res.status(403).json({
      ok: false,
      error: 'Administrator permission required for this resource.',
      code: 'FORBIDDEN_ADMIN_ONLY',
    });
    return;
  }
  next();
}

export function requireModuleAccess(moduleKey: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ ok: false, error: 'Authentication required.', code: 'AUTH_REQUIRED' });
      return;
    }
    if (!hasModuleCapability(req.auth.capabilities, moduleKey)) {
      res.status(403).json({
        ok: false,
        error: `Access to "${moduleKey}" is restricted for your account.`,
        code: 'FORBIDDEN_MODULE',
      });
      return;
    }
    next();
  };
}

export function requireActionAccess(actionKey: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ ok: false, error: 'Authentication required.', code: 'AUTH_REQUIRED' });
      return;
    }
    if (!hasActionCapability(req.auth.capabilities, actionKey)) {
      res.status(403).json({
        ok: false,
        error: `Action "${actionKey}" is restricted by Administrator.`,
        code: 'FORBIDDEN_ACTION',
      });
      return;
    }
    next();
  };
}

// ============================================================================
// LOGIN RATE LIMITER (In-Memory Abuse Protection)
// ============================================================================

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const rec = loginAttempts.get(key);
  if (!rec) return { allowed: true };
  if (rec.lockedUntil > Date.now()) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  if (rec.lockedUntil !== 0 && rec.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }
  return { allowed: true };
}

export function recordLoginFailure(key: string) {
  const prev = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  const nextCount = prev.count + 1;
  loginAttempts.set(key, {
    count: nextCount,
    lockedUntil: nextCount >= 8 ? Date.now() + 5 * 60 * 1000 : 0,
  });
}

export function clearLoginFailure(key: string) {
  loginAttempts.delete(key);
}

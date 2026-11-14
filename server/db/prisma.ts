import '../env';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  getMemoryPrismaClient,
  snapshotStagingAuthData,
} from './memoryPrismaStore';
import {
  buildPostgresConnectionUrl,
  checkPostgresHealth,
  closePostgresPool,
  getPostgresPool,
  hasConfiguredDatabaseUrl,
  parsePostgresUrlInfo,
  persistDatabaseUrlToEnv,
  pushPrismaSchemaOverPostgres,
  queryPostgres,
  reconnectPostgresPool,
  withPostgresTransaction,
  type PostgresHealthStatus,
} from '../services/postgresConnectionService';

export {
  buildPostgresConnectionUrl,
  checkPostgresHealth,
  closePostgresPool,
  getPostgresPool,
  hasConfiguredDatabaseUrl,
  parsePostgresUrlInfo,
  persistDatabaseUrlToEnv,
  queryPostgres,
  withPostgresTransaction,
  type PostgresHealthStatus,
};

/**
 * Decoupled Persistent Binary Storage (EXTERNAL_STORAGE_DIR -> ./storage on VPS -> os.tmpdir() fallback).
 * Directories are created lazily when a binary file is written — NEVER creates folders at startup.
 * PostgreSQL stores structured relational data and metadata; binary uploads stay separated on disk.
 */
function resolveStorageBasePath(): { basePath: string; isEphemeralTmp: boolean } {
  if (process.env.EXTERNAL_STORAGE_DIR && process.env.EXTERNAL_STORAGE_DIR.trim()) {
    return {
      basePath: path.resolve(process.env.EXTERNAL_STORAGE_DIR.trim()),
      isEphemeralTmp: false,
    };
  }
  const vpsDefault = path.resolve(process.cwd(), 'storage');
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    return { basePath: vpsDefault, isEphemeralTmp: false };
  } catch {
    return {
      basePath: path.join(os.tmpdir(), 'workspace-pro-storage'),
      isEphemeralTmp: true,
    };
  }
}

const resolvedStorage = resolveStorageBasePath();
export const EXTERNAL_STORAGE_BASE = resolvedStorage.basePath;
export const IS_EPHEMERAL_STORAGE = resolvedStorage.isEphemeralTmp;

export const UPLOADS_DIR = path.join(EXTERNAL_STORAGE_BASE, 'uploads');
export const VERSIONS_DIR = path.join(UPLOADS_DIR, '.versions');
export const THUMBS_DIR = path.join(UPLOADS_DIR, '.thumbs');

export function ensureExternalStorageDirs(): void {
  for (const dir of [EXTERNAL_STORAGE_BASE, UPLOADS_DIR, VERSIONS_DIR, THUMBS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function deriveMasterKey(): Buffer {
  const seed =
    process.env.WORKSPACE_MASTER_KEY ||
    process.env.DATABASE_URL ||
    'workspace-pro-postgres-vault';
  if (process.env.NODE_ENV === 'production' && !process.env.WORKSPACE_MASTER_KEY) {
    console.error(
      '[Security] WORKSPACE_MASTER_KEY is not set in production. Set a fixed secret in .env so encrypted mail credentials survive URL changes.'
    );
  }
  return crypto.createHash('sha256').update(seed).digest();
}

const MASTER_KEY = deriveMasterKey();

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  // SECURITY: Use recommended scrypt parameters (N=16384, r=8, p=1, dkLen=32)
  const derived = crypto.scryptSync(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
  }).toString('hex');
  return `scrypt$16384:8:1$${salt}$${derived}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const [, params, salt, originalHex] = parts;
  const [nStr, rStr, pStr] = params.split(':');
  const N = parseInt(nStr, 10) || 16384;
  const r = parseInt(rStr, 10) || 8;
  const p = parseInt(pStr, 10) || 1;
  const derived = crypto.scryptSync(password, salt, 32, { N, r, p });
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(cipherText: string): string {
  const [ivHex, tagHex, dataHex] = cipherText.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Invalid encrypted credential format.');
  }
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      MASTER_KEY,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    // SECURITY: Do not leak decryption details to caller
    throw new Error('Failed to decrypt credential.');
  }
}

export const DEFAULT_ADMIN_USERNAME =
  (process.env.ADMIN_USERNAME || 'admin@workspace.local').trim();
export const DEFAULT_ADMIN_NAME =
  (process.env.ADMIN_NAME || 'Administrator').trim() || 'Administrator';

const globalForPrisma = globalThis as unknown as {
  __workspacePrismaClient?: PrismaClient;
  __workspacePrismaUrl?: string;
};

function createRealPrismaClient(url: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}

export function isStagingMemoryMode(): boolean {
  return !hasConfiguredDatabaseUrl();
}

function getActivePrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!hasConfiguredDatabaseUrl(url)) {
    return getMemoryPrismaClient();
  }
  if (!globalForPrisma.__workspacePrismaClient || globalForPrisma.__workspacePrismaUrl !== url) {
    if (globalForPrisma.__workspacePrismaClient) {
      globalForPrisma.__workspacePrismaClient.$disconnect().catch(() => {});
    }
    globalForPrisma.__workspacePrismaClient = createRealPrismaClient(url);
    globalForPrisma.__workspacePrismaUrl = url;
  }
  return globalForPrisma.__workspacePrismaClient;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    if (prop === '$disconnect' && !globalForPrisma.__workspacePrismaClient) {
      return async () => {};
    }
    if (prop === 'then') {
      return undefined;
    }
    const client = getActivePrismaClient();
    const val = Reflect.get(client, prop, client);
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

export async function reinitializePostgresClient(
  connectionUrl: string,
  persistEnv = true
): Promise<void> {
  await reconnectPostgresPool(connectionUrl, persistEnv);

  if (globalForPrisma.__workspacePrismaClient) {
    await globalForPrisma.__workspacePrismaClient.$disconnect().catch(() => {});
    globalForPrisma.__workspacePrismaClient = undefined;
    globalForPrisma.__workspacePrismaUrl = undefined;
  }
  getActivePrismaClient();
}

export async function pushPrismaSchemaToPostgres(
  connectionUrl?: string
): Promise<{ ok: boolean; output: string }> {
  const stagingSnapshot = isStagingMemoryMode() ? snapshotStagingAuthData() : null;
  const result = await pushPrismaSchemaOverPostgres(connectionUrl);
  const targetUrl = (connectionUrl || process.env.DATABASE_URL || '').trim();
  if (hasConfiguredDatabaseUrl(targetUrl)) {
    await reinitializePostgresClient(targetUrl, true);
    if (stagingSnapshot) {
      const pg = getActivePrismaClient();
      for (const g of stagingSnapshot.teamGroups) {
        await pg.workspaceTeamGroup
          .upsert({
            where: { id: g.id },
            update: {},
            create: g as any,
          })
          .catch(() => {});
      }
      for (const u of stagingSnapshot.users) {
        await pg.workspaceUser
          .upsert({
            where: { id: u.id },
            update: {
              ...(u.passwordHash ? { passwordHash: u.passwordHash, passwordSet: u.passwordSet } : {}),
              name: u.name,
              email: u.email,
              username: u.username,
            },
            create: u as any,
          })
          .catch(() => {});
      }
      for (const s of stagingSnapshot.sessions) {
        await pg.workspaceSession
          .upsert({
            where: { id: s.id },
            update: { revokedAt: s.revokedAt, lastSeenAt: s.lastSeenAt },
            create: s as any,
          })
          .catch(() => {});
      }
    }
  }
  return result;
}

export async function ensurePostgresReady(_force = false): Promise<void> {
  if (!hasConfiguredDatabaseUrl()) {
    return;
  }
  await queryPostgres('SELECT 1');
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || '');
      const transient =
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('Connection pool timeout') ||
        msg.includes('terminating connection');
      if (!transient || i === retries - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 80 * (i + 1)));
    }
  }
  throw lastErr;
}

export function isDbUnavailableError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === 'POSTGRES_NOT_CONFIGURED' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === '28P01' ||
    code === '3D000' ||
    code === 'P1001' ||
    code === 'P1000' ||
    code === 'P1003' ||
    code === 'P2021' ||
    msg.includes('DATABASE_URL is not configured') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes("Can't reach database server") ||
    msg.includes('does not exist')
  );
}

export function formatDbError(err: any): string {
  const rawMessage = String(err?.message || 'PostgreSQL operation failed');
  const lines = rawMessage.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] || rawMessage;
}

export async function getPostgresDbStats(): Promise<{
  connected: boolean;
  configured: boolean;
  sizeBytes: number;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  maskedUrl: string;
  serverVersion?: string;
  tableCount?: number;
}> {
  const health = await checkPostgresHealth();
  return {
    connected: health.connected,
    configured: health.configured,
    sizeBytes: health.sizeBytes,
    host: health.host,
    port: health.port,
    database: health.database,
    user: health.user,
    ssl: health.ssl,
    maskedUrl: health.maskedUrl,
    serverVersion: health.serverVersion,
    tableCount: health.tableCount,
  };
}

export async function checkPrismaHealth(): Promise<PostgresHealthStatus> {
  return checkPostgresHealth();
}

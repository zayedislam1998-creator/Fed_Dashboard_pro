import '../env';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

const execFileAsync = promisify(execFile);

export interface PostgresUrlInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  maskedUrl: string;
}

export interface PostgresHealthStatus {
  connected: boolean;
  configured: boolean;
  schemaReady: boolean;
  tableCount: number;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  maskedUrl: string;
  serverVersion?: string;
  sizeBytes: number;
  pool: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  error?: string;
}

const globalForPg = globalThis as unknown as {
  __workspacePgPool?: Pool;
  __workspacePgUrl?: string;
};

export function getDatabaseUrl(overrideUrl?: string): string {
  return (overrideUrl ?? process.env.DATABASE_URL ?? '').trim();
}

export function hasConfiguredDatabaseUrl(urlStr?: string): boolean {
  const raw = getDatabaseUrl(urlStr);
  return raw.startsWith('postgresql://') || raw.startsWith('postgres://');
}

function shouldUseSsl(parsed: URL): boolean {
  const sslMode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
  const sslParam = (parsed.searchParams.get('ssl') || '').toLowerCase();
  if (sslMode === 'disable' || sslParam === 'false' || sslParam === '0') {
    return false;
  }
  if (
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'verify-ca' ||
    sslMode === 'prefer' ||
    sslParam === 'true' ||
    sslParam === '1'
  ) {
    return true;
  }
  const host = (parsed.hostname || '').toLowerCase();
  return (
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    host !== '::1' &&
    !host.endsWith('.local') &&
    host.includes('.')
  );
}

export function parsePostgresUrlInfo(urlStr?: string): PostgresUrlInfo {
  const raw = getDatabaseUrl(urlStr);
  if (!hasConfiguredDatabaseUrl(raw)) {
    return {
      host: '',
      port: 5432,
      database: '',
      user: '',
      ssl: false,
      maskedUrl: '',
    };
  }
  try {
    const parsed = new URL(raw);
    const database = parsed.pathname.replace(/^\//, '').split('/')[0] || 'postgres';
    const port = Number(parsed.port) || 5432;
    const ssl = shouldUseSsl(parsed);

    const masked = new URL(raw);
    if (masked.password) {
      masked.password = '••••••••';
    }

    return {
      host: parsed.hostname || 'localhost',
      port,
      database,
      user: decodeURIComponent(parsed.username || 'postgres'),
      ssl,
      maskedUrl: masked.toString(),
    };
  } catch {
    return {
      host: '',
      port: 5432,
      database: '',
      user: '',
      ssl: false,
      maskedUrl: '',
    };
  }
}

export function buildPostgresConnectionUrl(params: {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}): string {
  const cleanHost = String(params.host || 'localhost').trim();
  const cleanPort = Number(params.port) || 5432;
  const cleanDb = String(params.database || 'postgres').trim();
  const cleanUser = encodeURIComponent(String(params.user || 'postgres').trim());
  const cleanPass = params.password ? `:${encodeURIComponent(String(params.password))}` : '';
  const query = new URLSearchParams({ schema: 'public' });
  if (params.ssl) {
    query.set('sslmode', 'require');
  }
  return `postgresql://${cleanUser}${cleanPass}@${cleanHost}:${cleanPort}/${cleanDb}?${query.toString()}`;
}

export function persistDatabaseUrlToEnv(connectionUrl: string): boolean {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const escapedLine = `DATABASE_URL="${connectionUrl.replace(/"/g, '\\"')}"`;
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, `${escapedLine}\n`, 'utf-8');
      return true;
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    let replaced = false;
    const nextLines = lines.map((line) => {
      if (/^\s*DATABASE_URL\s*=/.test(line)) {
        replaced = true;
        return escapedLine;
      }
      return line;
    });
    if (!replaced) {
      nextLines.unshift(escapedLine);
    }
    const normalized = nextLines
      .filter((line, idx, arr) => idx < arr.length - 1 || line !== '')
      .join('\n');
    fs.writeFileSync(envPath, `${normalized}\n`, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function buildPgPoolConfig(connectionUrl: string): PoolConfig {
  const parsed = new URL(connectionUrl);
  const useSsl = shouldUseSsl(parsed);

  return {
    connectionString: connectionUrl,
    max: Number(process.env.PG_POOL_MAX) || 15,
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30_000,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 10_000,
    allowExitOnIdle: false,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function createManagedPool(connectionUrl: string): Pool {
  const pool = new Pool(buildPgPoolConfig(connectionUrl));
  pool.on('error', (err) => {
    console.warn('[PostgreSQL Pool] Idle client notice:', err?.message || err);
  });
  return pool;
}

/**
 * Returns the active singleton pg.Pool wired to process.env.DATABASE_URL.
 * Re-creates the pool automatically if DATABASE_URL changes at runtime.
 */
export function getPostgresPool(overrideUrl?: string): Pool {
  const url = getDatabaseUrl(overrideUrl);
  if (!hasConfiguredDatabaseUrl(url)) {
    throw Object.assign(
      new Error(
        'PostgreSQL DATABASE_URL is not configured. Set DATABASE_URL="postgresql://..." in .env or connect in Settings.'
      ),
      { code: 'POSTGRES_NOT_CONFIGURED' }
    );
  }

  if (overrideUrl) {
    return createManagedPool(url);
  }

  if (!globalForPg.__workspacePgPool || globalForPg.__workspacePgUrl !== url) {
    if (globalForPg.__workspacePgPool) {
      globalForPg.__workspacePgPool.end().catch(() => {});
    }
    globalForPg.__workspacePgPool = createManagedPool(url);
    globalForPg.__workspacePgUrl = url;
  }

  return globalForPg.__workspacePgPool;
}

/**
 * Executes a parameterized SQL query directly against the active PostgreSQL pool.
 */
export async function queryPostgres<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  const pool = getPostgresPool();
  return pool.query<T>(sql, params);
}

/**
 * Executes a callback within an explicit BEGIN / COMMIT / ROLLBACK transaction on a pg PoolClient.
 */
export async function withPostgresTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function reconnectPostgresPool(
  connectionUrl: string,
  persistEnv = true
): Promise<Pool> {
  const trimmed = connectionUrl.trim();
  if (!hasConfiguredDatabaseUrl(trimmed)) {
    throw new Error('Invalid PostgreSQL URL. Must start with postgresql:// or postgres://');
  }

  if (globalForPg.__workspacePgPool) {
    await globalForPg.__workspacePgPool.end().catch(() => {});
    globalForPg.__workspacePgPool = undefined;
    globalForPg.__workspacePgUrl = undefined;
  }

  process.env.DATABASE_URL = trimmed;
  if (persistEnv) {
    persistDatabaseUrlToEnv(trimmed);
  }

  return getPostgresPool();
}

export async function closePostgresPool(): Promise<void> {
  if (globalForPg.__workspacePgPool) {
    await globalForPg.__workspacePgPool.end().catch(() => {});
    globalForPg.__workspacePgPool = undefined;
    globalForPg.__workspacePgUrl = undefined;
  }
}

export async function testPostgresConnection(connectionUrl?: string): Promise<{
  ok: boolean;
  database: string;
  serverVersion: string;
  sizeBytes: number;
}> {
  const url = getDatabaseUrl(connectionUrl);
  if (!hasConfiguredDatabaseUrl(url)) {
    throw Object.assign(new Error('PostgreSQL DATABASE_URL is not configured yet.'), {
      code: 'POSTGRES_NOT_CONFIGURED',
    });
  }

  const isTransientProbe = Boolean(connectionUrl && connectionUrl.trim() !== getDatabaseUrl());
  const pool = isTransientProbe ? createManagedPool(url) : getPostgresPool();

  try {
    const res = await pool.query<{
      ok: number;
      server_version: string;
      database_name: string;
      size_bytes: string | number;
    }>(
      'SELECT 1 AS ok, version() AS server_version, current_database() AS database_name, pg_database_size(current_database())::bigint AS size_bytes'
    );
    const row = res.rows[0];
    return {
      ok: Number(row?.ok) === 1,
      database: String(row?.database_name || parsePostgresUrlInfo(url).database || 'postgres'),
      serverVersion: String(row?.server_version || '').split(' ').slice(0, 2).join(' '),
      sizeBytes: Number(row?.size_bytes || 0),
    };
  } finally {
    if (isTransientProbe) {
      await pool.end().catch(() => {});
    }
  }
}

export async function verifyPostgresSchemaReady(connectionUrl?: string): Promise<{
  schemaReady: boolean;
  tableCount: number;
}> {
  const url = getDatabaseUrl(connectionUrl);
  if (!hasConfiguredDatabaseUrl(url)) {
    return { schemaReady: false, tableCount: 0 };
  }

  const isTransientProbe = Boolean(connectionUrl && connectionUrl.trim() !== getDatabaseUrl());
  const pool = isTransientProbe ? createManagedPool(url) : getPostgresPool();

  try {
    const res = await pool.query<{
      users_table: string | null;
      table_count: number;
    }>(
      `SELECT
         to_regclass('public.workspace_users')::text AS users_table,
         (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS table_count`
    );
    const row = res.rows[0];
    return {
      schemaReady: Boolean(row?.users_table),
      tableCount: Number(row?.table_count || 0),
    };
  } finally {
    if (isTransientProbe) {
      await pool.end().catch(() => {});
    }
  }
}

export async function pushPrismaSchemaOverPostgres(
  connectionUrl?: string
): Promise<{ ok: boolean; output: string }> {
  const targetUrl = getDatabaseUrl(connectionUrl);
  if (!hasConfiguredDatabaseUrl(targetUrl)) {
    throw new Error('Valid PostgreSQL DATABASE_URL is required before pushing Prisma schema.');
  }

  // Probe live PostgreSQL connectivity directly via pg first
  await testPostgresConnection(targetUrl);

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const { stdout, stderr } = await execFileAsync(
    npxCmd,
    ['prisma', 'db', 'push', '--skip-generate'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: targetUrl,
      },
      timeout: 60_000,
    }
  );

  await reconnectPostgresPool(targetUrl, true);

  return {
    ok: true,
    output: [stdout, stderr].filter(Boolean).join('\n').trim(),
  };
}

export async function checkPostgresHealth(): Promise<PostgresHealthStatus> {
  const url = getDatabaseUrl();
  const info = parsePostgresUrlInfo(url);
  const configured = hasConfiguredDatabaseUrl(url);

  if (!configured) {
    return {
      connected: false,
      configured: false,
      schemaReady: false,
      tableCount: 0,
      ...info,
      sizeBytes: 0,
      pool: { totalCount: 0, idleCount: 0, waitingCount: 0 },
      error: 'DATABASE_URL is not configured. Add postgresql://... to .env or connect in Setup.',
    };
  }

  const pool = getPostgresPool();
  try {
    const stats = await testPostgresConnection();
    const schema = await verifyPostgresSchemaReady();

    return {
      connected: stats.ok,
      configured: true,
      schemaReady: schema.schemaReady,
      tableCount: schema.tableCount,
      ...info,
      serverVersion: stats.serverVersion,
      sizeBytes: stats.sizeBytes,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
      ...(!schema.schemaReady
        ? {
            error:
              'PostgreSQL connected via pg.Pool, but Prisma schema has not been pushed yet (run prisma db push).',
          }
        : {}),
    };
  } catch (err: any) {
    const msg = String(err?.message || 'PostgreSQL connection failed');
    return {
      connected: false,
      configured: true,
      schemaReady: false,
      tableCount: 0,
      ...info,
      sizeBytes: 0,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
      error: msg.split('\n').map((l) => l.trim()).filter(Boolean).pop() || msg,
    };
  }
}

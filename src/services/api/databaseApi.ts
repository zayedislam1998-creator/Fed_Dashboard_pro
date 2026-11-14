import { wsFetch as fetch } from '../sessionFetch';

export interface PostgresCatalogTable {
  tableName: string;
  rowCount: number;
  dataSize: string;
  indexSize: string;
  totalSize: string;
  totalBytes: number;
  dataBytes: number;
  indexBytes: number;
}

export interface PostgresCatalogInfo {
  connected: boolean;
  configured: boolean;
  serverVersion: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  maskedUrl: string;
  dbSizeBytes: number;
  dbSizePretty: string;
  tableCount: number;
  totalLiveRows: number;
  activeConnections: number;
  poolStatus: string;
  authStatus: string;
  userCount: number;
  sessionCount: number;
  envSaved: boolean;
  syncedAt: string;
  tables: PostgresCatalogTable[];
}

export interface PostgresConfigClient {
  enabled: boolean;
  mode: string;
  connectionString: string;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  autoMigrateOnStartup: boolean;
  dbFileSizeBytes: number;
  serverVersion?: string;
  lastMigratedAt?: string;
  statusMessage?: string;
}

export interface VpsStorageDiagnosticsClient {
  storageBasePath: string;
  isEphemeralTmp: boolean;
  browserCacheEnabled: boolean;
  diskTotalBytes: number;
  diskFreeBytes: number;
  uploadsBytes: number;
  versionsBytes: number;
  thumbsBytes: number;
  totalUsedBytes: number;
  activeFilesCount: number;
  trashedFilesCount: number;
  trashedBytes: number;
  versionsCount: number;
  orphanFilesCount: number;
  orphanBytes: number;
}

import { formatBytes } from './filesApi';

export async function fetchPostgresCatalog(): Promise<PostgresCatalogInfo> {
  const res = await fetch('/api/db/catalog');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch PostgreSQL catalog.');
  }
  return data;
}

export async function fetchDatabaseConfig(): Promise<{
  config: PostgresConfigClient;
  schemaSql: string;
  prismaSchema: string;
  stats: Record<string, number>;
}> {
  const res = await fetch('/api/db/config');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch database config.');
  }
  return data;
}

export async function saveDatabaseConfig(payload: {
  enabled?: boolean;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  autoMigrateOnStartup?: boolean;
  testAndMigrateNow?: boolean;
}): Promise<{
  ok: boolean;
  config: PostgresConfigClient;
  migration?: {
    ok: boolean;
    message: string;
    tablesCreated: string[];
  };
}> {
  const res = await fetch('/api/db/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'PostgreSQL connection failed.');
  }
  return data;
}

export async function exportWorkspaceBackupJson(): Promise<any> {
  const res = await fetch('/api/settings/backup');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to export backup.');
  }
  return data;
}

export async function restoreWorkspaceBackupJson(payload: any): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/settings/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to restore backup.');
  }
  return data;
}

export async function fetchVpsStorageDiagnostics(): Promise<VpsStorageDiagnosticsClient> {
  const res = await fetch('/api/settings/storage');
  const data = await res.json();
  if (!res.ok || !data.storage) {
    throw new Error(data.error || 'Failed to inspect VPS storage.');
  }
  return data.storage;
}

export async function runVpsStorageCleanup(options?: {
  pruneOrphans?: boolean;
  purgeTrashOlderThanDays?: number;
}): Promise<{
  cleanup: {
    removedOrphans: number;
    removedTrashedFiles: number;
    reclaimedBytes: number;
  };
  storage: VpsStorageDiagnosticsClient;
}> {
  const res = await fetch('/api/settings/storage/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to run storage cleanup.');
  }
  return data;
}

import React, { useState } from 'react';
import {
  HardDrive,
  ShieldCheck,
  Sparkles,
  Download,
  Upload,
  Database,
  RefreshCw,
  Search,
  Table,
  CheckCircle2,
  Server,
  Layers,
} from 'lucide-react';
import {
  VpsStorageDiagnosticsClient,
  PostgresCatalogInfo,
  PostgresConfigClient,
  formatBytes,
} from '../../services/workspaceApi';

interface StorageAndDatabaseTabProps {
  vpsDiag: VpsStorageDiagnosticsClient | null;
  catalogInfo: PostgresCatalogInfo | null;
  dbConfig: PostgresConfigClient | null;
  isLoadingCatalog: boolean;
  catalogLastLoaded: string;
  onRefreshCatalog: () => void;
  onRunStorageCleanup: (days: number) => void;
  isCleaningStorage: boolean;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  backupFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const StorageAndDatabaseTab: React.FC<StorageAndDatabaseTabProps> = ({
  vpsDiag,
  catalogInfo,
  dbConfig,
  isLoadingCatalog,
  catalogLastLoaded,
  onRefreshCatalog,
  onRunStorageCleanup,
  isCleaningStorage,
  onExportBackup,
  onImportBackup,
  backupFileInputRef,
}) => {
  const [tableSearch, setTableSearch] = useState('');
  const [nonEmptyOnly, setNonEmptyOnly] = useState(false);

  const tables = catalogInfo?.tables || [];
  const filteredTables = tables.filter((t) => {
    if (nonEmptyOnly && t.rowCount === 0) return false;
    if (tableSearch.trim()) {
      return t.tableName.toLowerCase().includes(tableSearch.toLowerCase().trim());
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. LIVE POSTGRESQL 16 RELATIONAL ENGINE STATUS & METRICS
      ===================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  PostgreSQL Relational Database
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                  {catalogInfo?.connected ? 'Live & Connected' : 'Connection status unavailable'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {catalogInfo?.serverVersion || 'PostgreSQL 16'} · Host: {catalogInfo?.host || 'db.ny1foundation.org'}:{catalogInfo?.port || 5432}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshCatalog}
              disabled={isLoadingCatalog}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${''}`} />
              <span>{'Refresh Stats'}</span>
            </button>
          </div>
        </div>

        {/* Database Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500">Database Name</div>
            <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {catalogInfo?.database || 'fobana_dashboard'}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              SSL: {catalogInfo?.ssl ? 'Enabled (Secure)' : 'Disabled'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500">Total Tables</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
              {catalogInfo?.tableCount ?? 53} Tables
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Public Schema Sync</div>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500">Live Table Rows</div>
            <div className="text-sm font-bold text-[#0B57D0] mt-1">
              {catalogInfo?.totalLiveRows?.toLocaleString() ?? 0} Rows
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active Records</div>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500">Total DB Size</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {catalogInfo?.dbSizePretty || formatBytes(catalogInfo?.dbSizeBytes || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Storage Footprint</div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. LIVE 53-TABLE CATALOG EXPLORER
      ===================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Table className="w-4 h-4 text-[#0B57D0]" />
              <span>Live Database Tables Explorer</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live schema catalog synced via Prisma ORM over PostgreSQL connection pool.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filter tables..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-44"
              />
            </div>

            <button
              type="button"
              onClick={() => setNonEmptyOnly(!nonEmptyOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors ${
                nonEmptyOnly
                  ? 'bg-blue-50 border-blue-200 text-[#0B57D0] dark:bg-blue-950/40'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Non-Empty Only
            </button>
          </div>
        </div>

        {/* Tables List */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {filteredTables.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {tables.length === 0 ? '' : 'No matching tables found.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200/80 dark:border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Table Name</th>
                  <th className="py-2.5 px-4 text-right">Row Count</th>
                  <th className="py-2.5 px-4 text-right">Data Size</th>
                  <th className="py-2.5 px-4 text-right">Index Size</th>
                  <th className="py-2.5 px-4 text-right">Total Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filteredTables.map((t) => (
                  <tr key={t.tableName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-4 font-sans font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>{t.tableName}</span>
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {t.rowCount.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-slate-500">
                      {t.dataSize}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-slate-500">
                      {t.indexSize}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {t.totalSize}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* =====================================================================
          3. VPS PERSISTENT STORAGE & CACHE DIAGNOSTICS
      ===================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#0B57D0]" />
              <span>Workspace Disk Storage &amp; Cache</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor disk utilization for uploads, generated previews, and cache.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isCleaningStorage}
              onClick={() => onRunStorageCleanup(30)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Clean Cache & Temp Files</span>
            </button>
          </div>
        </div>

        {vpsDiag ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500">Uploads &amp; Files</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatBytes(vpsDiag.uploadsBytes)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{vpsDiag.activeFilesCount} active files</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500">Thumbnails Cache</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatBytes(vpsDiag.thumbsBytes)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Image previews</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500">Trash Bin</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatBytes(vpsDiag.trashedBytes)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{vpsDiag.trashedFilesCount} pending purge</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500">Total Storage Used</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatBytes(vpsDiag.totalUsedBytes)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Persistent Storage</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500"></div>
        )}
      </div>

      {/* =====================================================================
          4. ONE-CLICK DATA BACKUP & RESTORE HUB
      ===================================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Download className="w-4 h-4 text-[#0B57D0]" />
              <span>One-Click Relational Data Backup &amp; Restore</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Export a complete JSON snapshot of workspace records (users, tasks, projects, forms) or restore from an existing backup.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Backup JSON</span>
            </button>

            <input
              ref={backupFileInputRef as any}
              type="file"
              accept=".json"
              onChange={onImportBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore Backup JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

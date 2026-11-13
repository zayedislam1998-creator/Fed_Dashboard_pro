import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Edit3,
  Download,
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  deleteEngineRecord,
  fetchEngineCollection,
  saveEngineRecord,
  WorkspaceSheetItem,
} from '../services/workspaceApi';
import { convertViaEngine } from '../services/engineCache';
import type { SheetTabModel } from './engines/SpreadsheetGridEngine';
import {
  UniversalDocumentEngineModal,
  UniversalEngineTarget,
} from './UniversalDocumentEngineModal';

const SpreadsheetGridEngine = lazy(() =>
  import('./engines/SpreadsheetGridEngine').then((m) => ({ default: m.SpreadsheetGridEngine }))
);

export type SheetsSubTab = 'all_sheets' | 'create_sheet';

interface SheetsViewProps {
  activeSubTab?: SheetsSubTab;
  onSubTabChange?: (tab: SheetsSubTab) => void;
}

function makeStarterSheet(): SheetTabModel[] {
  return [
    {
      name: 'Budget & Metrics',
      columns: ['Item / Category', 'Q1 Budget', 'Q2 Budget', 'Actual Spend', 'Variance'],
      rows: [
        ['Cloud Infrastructure', '1200', '1400', '1150', '=C2-D2'],
        ['Team Operations', '4500', '4600', '4400', '=C3-D3'],
        ['Marketing Campaigns', '2200', '2500', '2350', '=C4-D4'],
        ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)'],
      ],
    },
  ];
}

export const SheetsView: React.FC<SheetsViewProps> = ({
  activeSubTab = 'all_sheets',
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<SheetsSubTab>(activeSubTab);
  const [sheets, setSheets] = useState<WorkspaceSheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Active workbook state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [sheetTitle, setSheetTitle] = useState('Financial & KPI Tracker');
  const [sheetCategory, setSheetCategory] = useState('Operations');
  const [activeTabs, setActiveTabs] = useState<SheetTabModel[]>(() => makeStarterSheet());
  const [engineTarget, setEngineTarget] = useState<UniversalEngineTarget | null>(null);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const showNotice = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSheets = async () => {
    setLoading(true);
    try {
      const list = await fetchEngineCollection<WorkspaceSheetItem>('sheets');
      setSheets(list);
    } catch (err: any) {
      showNotice(err.message || 'Failed to load spreadsheets.', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheets();
  }, []);

  const switchTab = (next: SheetsSubTab) => {
    setSubTab(next);
    onSubTabChange?.(next);
  };

  const handleStartNew = () => {
    setEditingId(undefined);
    setSheetTitle('Untitled Spreadsheet');
    setSheetCategory('General');
    setActiveTabs(makeStarterSheet());
    switchTab('create_sheet');
  };

  const handleOpenSheet = (item: WorkspaceSheetItem) => {
    setEditingId(item.id);
    setSheetTitle(item.title);
    setSheetCategory(item.category || 'Operations');
    setActiveTabs([
      {
        name: item.title.slice(0, 24) || 'Sheet1',
        columns: item.columns?.length ? item.columns : ['A', 'B', 'C', 'D'],
        rows: item.rows?.length ? item.rows : [['', '', '', '']],
      },
    ]);
    switchTab('create_sheet');
  };

  const handleSaveSheet = async (tabsToSave = activeTabs) => {
    setSaving(true);
    try {
      const primary = tabsToSave[0] || { columns: ['A', 'B', 'C'], rows: [['', '', '']] };
      const res = await saveEngineRecord<WorkspaceSheetItem>('sheets', {
        id: editingId,
        title: sheetTitle.trim() || 'Untitled Spreadsheet',
        category: sheetCategory.trim() || 'General',
        columns: primary.columns,
        rows: primary.rows,
      });
      setSheets(res.items);
      setEditingId(res.item.id);
      showNotice(`Saved workbook "${res.item.title}" to workspace database!`);
    } catch (err: any) {
      showNotice(err.message || 'Save failed.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleExportToFileManager = async (
    kind: 'SHEETS_TO_XLSX' | 'TEXT_TO_PDF',
    titleStr = sheetTitle,
    tabs = activeTabs
  ) => {
    try {
      if (kind === 'SHEETS_TO_XLSX') {
        const res = await convertViaEngine({
          action: 'SHEETS_TO_XLSX',
          title: titleStr || 'Workbook',
          sheets: tabs,
          folderId: 'folder-documents',
        });
        showNotice(`Saved Excel workbook "${res.file.name}" to Server File Manager!`);
      } else {
        const lines = tabs.flatMap((t) => [
          `[${t.name}]`,
          t.columns.join(' | '),
          ...t.rows.map((r) => r.join(' | ')),
          '',
        ]);
        const res = await convertViaEngine({
          action: 'TEXT_TO_PDF',
          title: titleStr || 'Spreadsheet Report',
          lines,
          folderId: 'folder-documents',
        });
        showNotice(`Exported PDF "${res.file.name}" to File Manager!`);
      }
    } catch (err: any) {
      showNotice(err.message || 'Export failed.', false);
    }
  };

  const handleDelete = async (item: WorkspaceSheetItem) => {
    if (!window.confirm(`Delete spreadsheet "${item.title}"?`)) return;
    try {
      const items = await deleteEngineRecord<WorkspaceSheetItem>('sheets', item.id);
      setSheets(items);
      showNotice(`Deleted "${item.title}".`);
    } catch (err: any) {
      showNotice(err.message || 'Delete failed.', false);
    }
  };

  const filtered = sheets.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex flex-col bg-[#F6F8FC] overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">
              Sheets Engine (Excel Formula Grid & XLSX Studio)
            </h1>
            <p className="text-[11px] text-slate-500">
              Live fx formula bar (=SUM, =AVERAGE, =MIN, =MAX, =COUNT, =IF), cell formatting, sort, filter, XLSX import & export
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => switchTab('all_sheets')}
            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
              subTab === 'all_sheets' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            All Workbooks ({sheets.length})
          </button>
          <button
            type="button"
            onClick={() => (subTab === 'create_sheet' ? switchTab('create_sheet') : handleStartNew())}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
              subTab === 'create_sheet' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Spreadsheet Grid
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b ${
            toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {subTab === 'all_sheets' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search spreadsheets..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={handleStartNew}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Spreadsheet
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <FileSpreadsheet className="w-10 h-10 text-emerald-300 mx-auto" />
              <p className="text-sm font-bold text-slate-900">No spreadsheets found</p>
              <p className="text-xs text-slate-500">
                Create a live formula spreadsheet or import an .xlsx / .csv file directly in the grid.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3"
                >
                  <div onClick={() => handleOpenSheet(item)} className="cursor-pointer space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.category || 'Sheet'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {item.rows?.length || 0} × {item.columns?.length || 0} cells
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{item.title}</h3>
                    {/* Mini Grid Preview */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden text-[10px]">
                      <div className="grid grid-cols-3 bg-slate-100 font-bold text-slate-600">
                        {(item.columns || []).slice(0, 3).map((c, idx) => (
                          <div key={idx} className="px-2 py-1 truncate border-r border-slate-200 last:border-r-0">
                            {c}
                          </div>
                        ))}
                      </div>
                      {(item.rows || []).slice(0, 2).map((r, rIdx) => (
                        <div key={rIdx} className="grid grid-cols-3 border-t border-slate-100 text-slate-700">
                          {[0, 1, 2].map((cIdx) => (
                            <div key={cIdx} className="px-2 py-1 truncate border-r border-slate-100 last:border-r-0">
                              {r[cIdx] || '—'}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{item.updatedAt}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenSheet(item)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        Open Grid
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleExportToFileManager('SHEETS_TO_XLSX', item.title, [
                            { name: 'Sheet1', columns: item.columns, rows: item.rows },
                          ])
                        }
                        title="Save .xlsx to File Manager"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => switchTab('all_sheets')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <input
                value={sheetTitle}
                onChange={(e) => setSheetTitle(e.target.value)}
                placeholder="Workbook Title..."
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 min-w-[200px]"
              />
              <input
                value={sheetCategory}
                onChange={(e) => setSheetCategory(e.target.value)}
                placeholder="Category"
                className="hidden sm:block w-28 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportToFileManager('SHEETS_TO_XLSX')}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Save .xlsx to Drive
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveSheet()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Sheet
              </button>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                Loading Spreadsheet Formula Engine...
              </div>
            }
          >
            <SpreadsheetGridEngine
              title={sheetTitle}
              initialSheets={activeTabs}
              onChange={setActiveTabs}
              onSave={handleSaveSheet}
              onExportPdf={(tabs) => handleExportToFileManager('TEXT_TO_PDF', sheetTitle, tabs)}
            />
          </Suspense>
        </div>
      )}

      <UniversalDocumentEngineModal
        isOpen={!!engineTarget}
        target={engineTarget}
        onClose={() => setEngineTarget(null)}
        onSavedOrUpdated={loadSheets}
      />
    </div>
  );
};

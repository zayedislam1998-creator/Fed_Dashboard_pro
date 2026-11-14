import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Trash2,
  Download,
  FileText,
  ArrowUpAZ,
  ArrowDownZA,
  Filter,
  Snowflake,
  Undo2,
  Redo2,
  Save,
  Upload,
} from 'lucide-react';

export interface SheetTabModel {
  name: string;
  columns: string[];
  rows: string[][];
  colWidths?: number[];
  styles?: Record<
    string,
    {
      bold?: boolean;
      italic?: boolean;
      align?: 'left' | 'center' | 'right';
      color?: string;
      bg?: string;
      numFmt?: 'auto' | 'currency' | 'bdt' | 'percent' | 'number';
    }
  >;
}

interface SpreadsheetGridEngineProps {
  title: string;
  initialSheets: SheetTabModel[];
  readOnly?: boolean;
  onChange?: (sheets: SheetTabModel[]) => void;
  onSave?: (sheets: SheetTabModel[]) => Promise<void>;
  onExportPdf?: (sheets: SheetTabModel[]) => void;
}

function colIndexToLetter(idx: number): string {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i++) {
    col = col * 26 + (m[1].charCodeAt(i) - 64);
  }
  return { col: col - 1, row: parseInt(m[2], 10) - 1 };
}

function toNumeric(raw: string): number | null {
  if (raw === '' || raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[$,৳%\s]/g, '').replace(/,/g, '');
  if (!cleaned || Number.isNaN(Number(cleaned))) return null;
  return Number(cleaned);
}

export function evaluateSheetCell(
  raw: string,
  rows: string[][],
  visited: Set<string> = new Set()
): string {
  if (!raw || !raw.startsWith('=')) return raw;
  const expr = raw.slice(1).trim();
  if (!expr) return '';

  const getCellRawOrEval = (r: number, c: number): string => {
    if (r < 0 || c < 0 || r >= rows.length || c >= (rows[r]?.length || 0)) return '';
    const key = `${r}:${c}`;
    if (visited.has(key)) return '0';
    visited.add(key);
    const val = rows[r][c] || '';
    return val.startsWith('=') ? evaluateSheetCell(val, rows, visited) : val;
  };

  const expandRangeValues = (rangeToken: string): string[] => {
    const t = rangeToken.trim().toUpperCase();
    // Legacy whole-column shorthand: e.g. C
    if (/^[A-Z]+$/.test(t)) {
      const col = parseCellRef(`${t}1`)?.col ?? -1;
      if (col < 0) return [];
      return rows.map((_, r) => getCellRawOrEval(r, col)).filter((v) => v !== '');
    }
    if (t.includes(':')) {
      const [startStr, endStr] = t.split(':');
      const a = parseCellRef(startStr);
      const b = parseCellRef(endStr);
      if (!a || !b) return [];
      const out: string[] = [];
      for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
        for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
          out.push(getCellRawOrEval(r, c));
        }
      }
      return out;
    }
    const single = parseCellRef(t);
    if (single) return [getCellRawOrEval(single.row, single.col)];
    return [rangeToken.replace(/^['"]|['"]$/g, '')];
  };

  const evalFn = (fnName: string, argsRaw: string): string => {
    const args = argsRaw.split(',').map((a) => a.trim());
    const upper = fnName.toUpperCase();

    if (upper === 'CONCAT' || upper === 'CONCATENATE') {
      return args.flatMap(expandRangeValues).join('');
    }
    if (upper === 'COUNTA') {
      return String(args.flatMap(expandRangeValues).filter((v) => v.trim() !== '').length);
    }
    if (upper === 'IF' && args.length >= 3) {
      const cond = args[0];
      const condMatch = cond.match(/^(.+?)(>=|<=|<>|!=|=|>|<)(.+)$/);
      let isTrue = false;
      if (condMatch) {
        const left = expandRangeValues(condMatch[1])[0] ?? condMatch[1];
        const right = expandRangeValues(condMatch[3])[0] ?? condMatch[3];
        const ln = toNumeric(left);
        const rn = toNumeric(right);
        const op = condMatch[2];
        if (ln !== null && rn !== null) {
          isTrue =
            op === '>' ? ln > rn : op === '<' ? ln < rn : op === '>=' ? ln >= rn : op === '<=' ? ln <= rn : op === '=' ? ln === rn : ln !== rn;
        } else {
          isTrue = op === '=' ? left === right : op === '<>' || op === '!=' ? left !== right : false;
        }
      }
      const chosen = isTrue ? args[1] : args[2];
      return expandRangeValues(chosen)[0] ?? chosen.replace(/^['"]|['"]$/g, '');
    }

    const nums = args
      .flatMap(expandRangeValues)
      .map(toNumeric)
      .filter((n): n is number => n !== null);

    if (upper === 'COUNT') return String(nums.length);
    if (nums.length === 0) return '0';
    if (upper === 'SUM') return nums.reduce((a, b) => a + b, 0).toFixed(2).replace(/\.00$/, '');
    if (upper === 'AVG' || upper === 'AVERAGE') return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2).replace(/\.00$/, '');
    if (upper === 'MIN') return String(Math.min(...nums));
    if (upper === 'MAX') return String(Math.max(...nums));
    if (upper === 'ROUND') {
      const val = nums[0] ?? 0;
      const dec = nums[1] ?? 0;
      return val.toFixed(Math.max(0, Math.min(6, Math.round(dec))));
    }
    return raw;
  };

  try {
    let substituted = expr.replace(/([A-Za-z]+)\(([^()]*)\)/g, (_m, fn, args) => {
      const res = evalFn(fn, args);
      return toNumeric(res) !== null ? res : `"${res}"`;
    });

    // Replace cell references like A1, B2 in arithmetic expressions
    substituted = substituted.replace(/\b([A-Z]{1,3}\d{1,5})\b/gi, (token) => {
      const ref = parseCellRef(token);
      if (!ref) return token;
      const val = getCellRawOrEval(ref.row, ref.col);
      const num = toNumeric(val);
      return num !== null ? String(num) : '0';
    });

    if (/^[0-9+\-*/().\s]+$/.test(substituted)) {
      const val = Function(`"use strict"; return (${substituted});`)();
      if (typeof val === 'number' && Number.isFinite(val)) {
        return Number.isInteger(val) ? String(val) : val.toFixed(2).replace(/\.00$/, '');
      }
    }
    return substituted.replace(/^"|"$/g, '');
  } catch {
    return '#ERR';
  }
}

export const SpreadsheetGridEngine: React.FC<SpreadsheetGridEngineProps> = ({
  title,
  initialSheets,
  readOnly = false,
  onChange,
  onSave,
  onExportPdf,
}) => {
  const [sheets, setSheets] = useState<SheetTabModel[]>(() =>
    initialSheets.length > 0
      ? initialSheets
      : [{ name: 'Sheet1', columns: ['Column A', 'Column B', 'Column C', 'Column D'], rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']] }]
  );
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [freezeHeader, setFreezeHeader] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [history, setHistory] = useState<SheetTabModel[][]>([]);
  const [redoStack, setRedoStack] = useState<SheetTabModel[][]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialSheets && initialSheets.length > 0) {
      setSheets(initialSheets);
      setActiveSheetIdx(0);
    }
  }, [title]);

  const activeSheet = sheets[activeSheetIdx] || sheets[0];
  const cellKey = `${selectedCell.row}:${selectedCell.col}`;
  const activeStyle = activeSheet?.styles?.[cellKey] || {};
  const activeRawValue = activeSheet?.rows?.[selectedCell.row]?.[selectedCell.col] ?? '';
  const activeAddr = `${colIndexToLetter(selectedCell.col)}${selectedCell.row + 1}`;

  const commitSheets = (next: SheetTabModel[], recordHistory = true) => {
    if (recordHistory) {
      setHistory((h) => [...h.slice(-19), sheets]);
      setRedoStack([]);
    }
    setSheets(next);
    onChange?.(next);
  };

  const updateActiveSheet = (updater: (s: SheetTabModel) => SheetTabModel, recordHistory = true) => {
    const next = sheets.map((s, idx) => (idx === activeSheetIdx ? updater(s) : s));
    commitSheets(next, recordHistory);
  };

  const updateCellValue = (r: number, c: number, val: string) => {
    if (readOnly) return;
    updateActiveSheet((s) => {
      const nextRows = s.rows.map((row, rIdx) =>
        rIdx === r ? row.map((cell, cIdx) => (cIdx === c ? val : cell)) : row
      );
      return { ...s, rows: nextRows };
    });
  };

  const updateCellStyle = (patch: Partial<NonNullable<SheetTabModel['styles']>[string]>) => {
    if (readOnly) return;
    updateActiveSheet((s) => ({
      ...s,
      styles: {
        ...(s.styles || {}),
        [cellKey]: { ...(s.styles?.[cellKey] || {}), ...patch },
      },
    }));
  };

  const handleSortColumn = (colIdx: number, asc: boolean) => {
    updateActiveSheet((s) => {
      const sorted = [...s.rows].sort((a, b) => {
        const av = a[colIdx] || '';
        const bv = b[colIdx] || '';
        const an = toNumeric(av);
        const bn = toNumeric(bv);
        if (an !== null && bn !== null) return asc ? an - bn : bn - an;
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      return { ...s, rows: sorted };
    });
  };

  const handleImportXlsxOrCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const imported: SheetTabModel[] = wb.SheetNames.map((name) => {
      const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, defval: '' }) as any[][];
      const firstRow = Array.isArray(aoa[0]) ? aoa[0].map((v) => String(v ?? '')) : [];
      const maxCols = Math.max(4, firstRow.length, ...aoa.map((r) => (Array.isArray(r) ? r.length : 0)));
      const columns = Array.from({ length: maxCols }, (_, i) => firstRow[i] || `Column ${colIndexToLetter(i)}`);
      const rows = (aoa.length > 1 ? aoa.slice(1) : [['']]).map((r) =>
        Array.from({ length: maxCols }, (_, i) => String((Array.isArray(r) ? r[i] : '') ?? ''))
      );
      return { name, columns, rows };
    });
    if (imported.length > 0) {
      commitSheets(imported);
      setActiveSheetIdx(0);
    }
    e.target.value = '';
  };

  const handleDownloadWorkbook = (asCsv = false) => {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const evaluatedRows = s.rows.map((row) =>
        row.map((val) => (val.startsWith('=') ? evaluateSheetCell(val, s.rows) : val))
      );
      const ws = XLSX.utils.aoa_to_sheet([s.columns, ...evaluatedRows]);
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    if (asCsv) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `${title || 'sheet'}.csv`;
      a.click();
      URL.revokeObjectURL(u);
      return;
    }
    XLSX.writeFile(wb, `${title || 'workbook'}.xlsx`);
  };

  const handlePasteTsv = (e: React.ClipboardEvent, startR: number, startC: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter((l, idx, arr) => idx < arr.length - 1 || l !== '');
    updateActiveSheet((s) => {
      const nextRows = s.rows.map((r) => [...r]);
      const neededRows = startR + lines.length;
      while (nextRows.length < neededRows) {
        nextRows.push(s.columns.map(() => ''));
      }
      lines.forEach((line, rOff) => {
        const cols = line.split('\t');
        cols.forEach((cellVal, cOff) => {
          const targetC = startC + cOff;
          if (targetC < s.columns.length) {
            nextRows[startR + rOff][targetC] = cellVal;
          }
        });
      });
      return { ...s, rows: nextRows };
    });
  };

  const formatCellDisplay = (val: string, style?: NonNullable<SheetTabModel['styles']>[string]): string => {
    const computed = val.startsWith('=') ? evaluateSheetCell(val, activeSheet.rows) : val;
    if (!style?.numFmt || style.numFmt === 'auto') return computed;
    const num = toNumeric(computed);
    if (num === null) return computed;
    if (style.numFmt === 'currency') return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (style.numFmt === 'bdt') return `৳${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    if (style.numFmt === 'percent') return `${(num * 100).toFixed(1)}%`;
    return num.toLocaleString();
  };

  const visibleRows = useMemo(() => {
    return activeSheet.rows
      .map((r, origIdx) => ({ r, origIdx }))
      .filter(({ r }) => {
        if (!filterText.trim()) return true;
        const q = filterText.trim().toLowerCase();
        return r.some((cell) => String(cell).toLowerCase().includes(q));
      });
  }, [activeSheet.rows, filterText]);

  const moveFocus = (r: number, c: number) => {
    const nextR = Math.max(0, Math.min(activeSheet.rows.length - 1, r));
    const nextC = Math.max(0, Math.min(activeSheet.columns.length - 1, c));
    setSelectedCell({ row: nextR, col: nextC });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Excel / Google Sheets Formatting Ribbon */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            disabled={history.length === 0}
            onClick={() => {
              const prev = history[history.length - 1];
              if (!prev) return;
              setRedoStack((r) => [...r, sheets]);
              setHistory((h) => h.slice(0, -1));
              setSheets(prev);
              onChange?.(prev);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={() => {
              const next = redoStack[redoStack.length - 1];
              if (!next) return;
              setHistory((h) => [...h, sheets]);
              setRedoStack((r) => r.slice(0, -1));
              setSheets(next);
              onChange?.(next);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={() => updateCellStyle({ bold: !activeStyle.bold })}
            className={`p-1.5 rounded-lg cursor-pointer ${activeStyle.bold ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-100 text-slate-700'}`}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => updateCellStyle({ italic: !activeStyle.italic })}
            className={`p-1.5 rounded-lg cursor-pointer ${activeStyle.italic ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-100 text-slate-700'}`}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => updateCellStyle({ align: 'left' })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"><AlignLeft className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => updateCellStyle({ align: 'center' })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"><AlignCenter className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => updateCellStyle({ align: 'right' })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"><AlignRight className="w-3.5 h-3.5" /></button>

          <input
            type="color"
            title="Cell Fill Color"
            value={activeStyle.bg || '#ffffff'}
            onChange={(e) => updateCellStyle({ bg: e.target.value })}
            className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
          />
          <select
            value={activeStyle.numFmt || 'auto'}
            onChange={(e) => updateCellStyle({ numFmt: e.target.value as any })}
            className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="auto">Format: Auto</option>
            <option value="number">1,234</option>
            <option value="currency">$ USD</option>
            <option value="bdt">৳ BDT</option>
            <option value="percent">% Percent</option>
          </select>

          <span className="h-4 w-px bg-slate-200 mx-1" />

          <button type="button" onClick={() => handleSortColumn(selectedCell.col, true)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer" title="Sort Selected Column A→Z">
            <ArrowUpAZ className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => handleSortColumn(selectedCell.col, false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer" title="Sort Selected Column Z→A">
            <ArrowDownZA className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowFilterBar((v) => !v)}
            className={`p-1.5 rounded-lg cursor-pointer ${showFilterBar ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-100 text-slate-700'}`}
            title="Filter Rows"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFreezeHeader((v) => !v)}
            className={`p-1.5 rounded-lg cursor-pointer ${freezeHeader ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-700'}`}
            title="Freeze Header Row"
          >
            <Snowflake className="w-3.5 h-3.5" />
          </button>

          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() =>
                  updateActiveSheet((s) => ({
                    ...s,
                    columns: [...s.columns, `Column ${colIndexToLetter(s.columns.length)}`],
                    rows: s.rows.map((r) => [...r, '']),
                  }))
                }
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
              >
                + Col
              </button>
              <button
                type="button"
                onClick={() =>
                  updateActiveSheet((s) => ({
                    ...s,
                    rows: [...s.rows, s.columns.map(() => '')],
                  }))
                }
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
              >
                + Row
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!readOnly && (
            <label className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import .XLSX/.CSV</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportXlsxOrCsv} className="hidden" />
            </label>
          )}
          <button
            type="button"
            onClick={() => handleDownloadWorkbook(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> .XLSX
          </button>
          <button
            type="button"
            onClick={() => handleDownloadWorkbook(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
          >
            .CSV
          </button>
          {onExportPdf && (
            <button
              type="button"
              onClick={() => onExportPdf(sheets)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          )}
          {onSave && !readOnly && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(sheets);
                } finally {
                  setSaving(false);
                }
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Formula Bar (fx) */}
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
        <span className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-mono text-xs font-extrabold text-emerald-800 min-w-[52px] text-center">
          {activeAddr}
        </span>
        <span className="text-xs font-serif italic font-bold text-slate-500 px-1">fx</span>
        <input
          type="text"
          readOnly={readOnly}
          value={activeRawValue}
          onChange={(e) => updateCellValue(selectedCell.row, selectedCell.col, e.target.value)}
          placeholder="Enter value or formula: =SUM(B1:B5), =AVERAGE(C1:C5), =B2*C2, =IF(C2>100, High, Normal)"
          className="flex-1 px-3 py-1 rounded-md border border-slate-200 bg-white font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
        />
        {showFilterBar && (
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter grid rows..."
            className="px-2.5 py-1 rounded-md border border-emerald-300 bg-white text-xs w-44"
          />
        )}
      </div>

      {/* Main Spreadsheet Grid */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="border-collapse text-xs w-full">
          <thead className={freezeHeader ? 'sticky top-0 z-10' : ''}>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="w-11 min-w-[44px] px-2 py-1.5 text-center font-mono text-[11px] font-bold text-slate-500 border-r border-slate-300 bg-slate-100">
                #
              </th>
              {activeSheet.columns.map((col, colIdx) => {
                const widthPx = activeSheet.colWidths?.[colIdx] || 150;
                return (
                  <th
                    key={colIdx}
                    style={{ width: `${widthPx}px`, minWidth: `${widthPx}px` }}
                    className={`border-r border-slate-300 p-0 text-left relative ${
                      selectedCell.col === colIdx ? 'bg-emerald-50/90' : 'bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1 px-1.5 py-1">
                      <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold shrink-0">
                        {colIndexToLetter(colIdx)}
                      </span>
                      <input
                        type="text"
                        readOnly={readOnly}
                        value={col}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateActiveSheet((s) => ({
                            ...s,
                            columns: s.columns.map((c, i) => (i === colIdx ? v : c)),
                          }));
                        }}
                        className="w-full bg-transparent font-bold text-slate-800 text-xs focus:outline-none focus:bg-white px-1 rounded"
                      />
                    </div>
                  </th>
                );
              })}
              {!readOnly && <th className="w-9 bg-slate-100 border-b border-slate-300" />}
            </tr>
          </thead>

          <tbody>
            {visibleRows.map(({ r, origIdx }) => (
              <tr key={origIdx} className="border-b border-slate-200 hover:bg-slate-50/50">
                <td
                  className={`px-2 py-1 text-center font-mono text-[11px] border-r border-slate-300 select-none ${
                    selectedCell.row === origIdx ? 'bg-emerald-50 font-bold text-emerald-800' : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  {origIdx + 1}
                </td>
                {activeSheet.columns.map((_, colIdx) => {
                  const key = `${origIdx}:${colIdx}`;
                  const cellSt = activeSheet.styles?.[key];
                  const rawVal = r[colIdx] ?? '';
                  const isFocused = selectedCell.row === origIdx && selectedCell.col === colIdx;
                  const displayVal = isFocused ? rawVal : formatCellDisplay(rawVal, cellSt);

                  return (
                    <td
                      key={colIdx}
                      onClick={() => setSelectedCell({ row: origIdx, col: colIdx })}
                      style={{ backgroundColor: cellSt?.bg || undefined }}
                      className={`border-r border-slate-200 p-0 ${
                        isFocused ? 'ring-2 ring-inset ring-emerald-600 z-[1] relative' : ''
                      }`}
                    >
                      <input
                        type="text"
                        readOnly={readOnly}
                        value={displayVal}
                        onFocus={() => setSelectedCell({ row: origIdx, col: colIdx })}
                        onPaste={(e) => handlePasteTsv(e, origIdx, colIdx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            moveFocus(origIdx + 1, colIdx);
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            moveFocus(origIdx - 1, colIdx);
                          } else if (e.key === 'Tab') {
                            e.preventDefault();
                            moveFocus(origIdx, colIdx + (e.shiftKey ? -1 : 1));
                          }
                        }}
                        onChange={(e) => updateCellValue(origIdx, colIdx, e.target.value)}
                        style={{
                          textAlign: cellSt?.align || 'left',
                          color: cellSt?.color || undefined,
                          fontWeight: cellSt?.bold ? 700 : 400,
                          fontStyle: cellSt?.italic ? 'italic' : 'normal',
                        }}
                        className={`w-full px-2 py-1.5 text-xs bg-transparent focus:outline-none ${
                          rawVal.startsWith('=') && !isFocused ? 'text-emerald-800 font-semibold' : 'text-slate-800'
                        }`}
                      />
                    </td>
                  );
                })}
                {!readOnly && (
                  <td className="px-1 text-center border-r border-slate-100">
                    {activeSheet.rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveSheet((s) => ({
                            ...s,
                            rows: s.rows.filter((_, idx) => idx !== origIdx),
                          }))
                        }
                        className="p-1 text-slate-300 hover:text-rose-600"
                        title="Delete row"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Multi-Sheet Tabs Bar */}
      <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1">
          {sheets.map((s, idx) => (
            <button
              key={`${s.name}-${idx}`}
              type="button"
              onClick={() => {
                setActiveSheetIdx(idx);
                setSelectedCell({ row: 0, col: 0 });
              }}
              className={`px-3 py-1 rounded-t-lg text-xs font-bold border transition-colors cursor-pointer ${
                idx === activeSheetIdx
                  ? 'bg-white border-slate-300 text-emerald-700 shadow-2xs'
                  : 'bg-slate-200/70 border-transparent text-slate-600 hover:bg-white/70'
              }`}
            >
              {s.name}
            </button>
          ))}
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                const nextName = `Sheet${sheets.length + 1}`;
                commitSheets([
                  ...sheets,
                  { name: nextName, columns: ['Column A', 'Column B', 'Column C', 'Column D'], rows: [['', '', '', ''], ['', '', '', '']] },
                ]);
                setActiveSheetIdx(sheets.length);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Sheet
            </button>
          )}
        </div>
        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
          {activeSheet.rows.length} rows × {activeSheet.columns.length} cols · Excel TSV Copy/Paste Supported
        </span>
      </div>
    </div>
  );
};

import React, { Suspense, lazy, useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  Eye,
  CheckCircle2,
  X,
  Printer,
  Image as ImageIcon,
  Edit3,
  Download,
} from 'lucide-react';
import {
  WorkspaceInvoiceItem,
  WorkspaceExpenseItem,
  InvoiceLineItem,
  fetchEngineCollection,
  saveEngineRecord,
  deleteEngineRecord,
  fetchFinanceBrandLogo,
  saveFinanceBrandLogo,
} from '../services/workspaceApi';
import { convertViaEngine } from '../services/engineCache';
import { FileManagerPickerModal } from './FileManagerPickerModal';
import type { ImageEditorTarget } from './ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('./ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

export type FinanceSubTab = 'invoices' | 'expenses' | 'create_finance';

interface FinanceViewProps {
  activeSubTab?: FinanceSubTab;
  onSubTabChange?: (tab: FinanceSubTab) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  activeSubTab = 'invoices',
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<FinanceSubTab>(activeSubTab);
  const [invoices, setInvoices] = useState<WorkspaceInvoiceItem[]>([]);
  const [expenses, setExpenses] = useState<WorkspaceExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<WorkspaceInvoiceItem | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>('');
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [editingLogoTarget, setEditingLogoTarget] = useState<ImageEditorTarget | null>(null);

  const updateBrandLogo = (url: string) => {
    setBrandLogoUrl(url);
    saveFinanceBrandLogo(url).catch(() => {});
  };

  const handleExportFinanceXlsx = async () => {
    try {
      const res = await convertViaEngine({
        action: 'SHEETS_TO_XLSX',
        title: `Finance_Ledger_${new Date().toISOString().slice(0, 10)}`,
        sheets: [
          {
            name: 'Invoices & Quotes',
            columns: ['Type', 'Number', 'Client', 'Email', 'Due Date', 'Status', 'Currency', 'Total'],
            rows: invoices.map((i) => [
              i.docType,
              i.invoiceNumber,
              i.clientName,
              i.clientEmail,
              i.dueDate,
              i.status,
              i.currency,
              String(i.totalAmount || 0),
            ]),
          },
          {
            name: 'Expenses',
            columns: ['Title', 'Category', 'Vendor', 'Date', 'Currency', 'Amount'],
            rows: expenses.map((e) => [
              e.title,
              e.category,
              e.vendor || '',
              e.date,
              e.currency,
              String(e.amount || 0),
            ]),
          },
        ],
        folderId: 'folder-documents',
      });
      setBanner(`Saved Finance Ledger "${res.file.name}" to Server File Manager!`);
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner(err?.message || 'Export failed.');
    }
  };

  const handleSaveInvoicePdf = async (inv: WorkspaceInvoiceItem) => {
    try {
      const lines = [
        `${inv.docType} #${inv.invoiceNumber}`,
        `Billed To: ${inv.clientName} (${inv.clientEmail})`,
        `Status: ${inv.status} | Due Date: ${inv.dueDate}`,
        '----------------------------------------',
        ...(inv.items || []).map(
          (l) => `${l.description} x ${l.quantity} = ${inv.currency} ${(l.quantity * l.unitPrice).toFixed(2)}`
        ),
        '----------------------------------------',
        `Total Amount: ${inv.currency} ${Number(inv.totalAmount || 0).toFixed(2)}`,
      ];
      const res = await convertViaEngine({
        action: 'TEXT_TO_PDF',
        title: `${inv.docType}_${inv.invoiceNumber}_${inv.clientName}`,
        lines,
        folderId: 'folder-documents',
      });
      setBanner(`Saved PDF "${res.file.name}" to Server File Manager!`);
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner(err?.message || 'PDF export failed.');
    }
  };

  const [entryMode, setEntryMode] = useState<'INVOICE' | 'EXPENSE'>('INVOICE');
  const [docType, setDocType] = useState<'INVOICE' | 'QUOTATION'>('INVOICE');
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-${Date.now().toString().slice(-5)}`);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState<WorkspaceInvoiceItem['status']>('Unpaid');
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmt, setDiscountAmt] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { id: 'item-1', description: 'Consulting & Development Services', quantity: 1, unitPrice: 0 },
  ]);

  // Expense form fields
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState('Server & Cloud');
  const [expAmount, setExpAmount] = useState(0);
  const [expVendor, setExpVendor] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: FinanceSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const loadFinance = async () => {
    setLoading(true);
    try {
      const [invList, expList, savedLogo] = await Promise.all([
        fetchEngineCollection<WorkspaceInvoiceItem>('invoices'),
        fetchEngineCollection<WorkspaceExpenseItem>('expenses'),
        fetchFinanceBrandLogo(),
      ]);
      setInvoices(invList);
      setExpenses(expList);
      if (savedLogo) setBrandLogoUrl(savedLogo);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  const subtotal = items.reduce((acc, it) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
  const taxAmt = (subtotal * Number(taxPercent || 0)) / 100;
  const computedTotal = Math.max(0, subtotal + taxAmt - Number(discountAmt || 0));

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    const res = await saveEngineRecord<WorkspaceInvoiceItem>('invoices', {
      invoiceNumber,
      docType,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      projectTitle: projectTitle.trim(),
      issueDate,
      dueDate,
      currency,
      items,
      taxPercent: Number(taxPercent || 0),
      discountAmt: Number(discountAmt || 0),
      totalAmount: computedTotal,
      status,
      notes: notes.trim(),
    });
    setInvoices(res.items);
    setBanner(`${docType === 'QUOTATION' ? 'Quotation' : 'Invoice'} ${res.item.invoiceNumber} saved.`);
    setTimeout(() => setBanner(null), 3000);
    setInvoiceNumber(`INV-${Date.now().toString().slice(-5)}`);
    setClientName('');
    setClientEmail('');
    switchTab('invoices');
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim()) return;
    const res = await saveEngineRecord<WorkspaceExpenseItem>('expenses', {
      title: expTitle.trim(),
      category: expCategory,
      amount: Number(expAmount || 0),
      currency,
      date: expDate,
      vendor: expVendor.trim(),
      projectTitle: projectTitle.trim(),
      status: 'Approved',
    });
    setExpenses(res.items);
    setBanner(`Expense "${res.item.title}" recorded.`);
    setTimeout(() => setBanner(null), 3000);
    setExpTitle('');
    setExpAmount(0);
    switchTab('expenses');
  };

  const totalPaid = invoices
    .filter((i) => i.status === 'Paid' && i.docType === 'INVOICE')
    .reduce((a, b) => a + Number(b.totalAmount || 0), 0);
  const totalUnpaid = invoices
    .filter((i) => (i.status === 'Unpaid' || i.status === 'Overdue') && i.docType === 'INVOICE')
    .reduce((a, b) => a + Number(b.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((a, b) => a + Number(b.amount || 0), 0);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => switchTab('invoices')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'invoices'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Invoices & Quotes ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('expenses')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'expenses'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Expenses ({expenses.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('create_finance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_finance'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Invoice / Expense
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {brandLogoUrl ? (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <img src={brandLogoUrl} alt="Logo" className="w-5 h-5 rounded object-cover" />
              <button
                type="button"
                onClick={() =>
                  setEditingLogoTarget({
                    title: 'Company Invoice Logo',
                    imageUrl: brandLogoUrl,
                    defaultAspect: 'free',
                  })
                }
                className="text-[11px] font-bold text-purple-700 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" /> Edit Logo
              </button>
              <button
                type="button"
                onClick={() => setShowLogoPicker(true)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogoPicker(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Invoice Logo
            </button>
          )}
          <button
            type="button"
            onClick={handleExportFinanceXlsx}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export .xlsx
          </button>
        </div>
      </div>

      {banner && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {banner}
          </span>
          <button type="button" onClick={() => setBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Bar */}
      <div className="px-3 sm:px-6 pt-3">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold text-slate-500">Paid Revenue</div>
            <div className="text-base font-extrabold text-emerald-600 mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> ${totalPaid.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold text-slate-500">Unpaid / Due</div>
            <div className="text-base font-extrabold text-amber-600 mt-0.5">
              ${totalUnpaid.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold text-slate-500">Total Expenses</div>
            <div className="text-base font-extrabold text-rose-600 mt-0.5">
              ${totalExpenses.toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold text-slate-500">Net Balance</div>
            <div className="text-base font-extrabold text-slate-900 mt-0.5 flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              ${(totalPaid - totalExpenses).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {subTab === 'invoices' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-sm font-medium text-slate-700">No invoices or quotations yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Use the &ldquo;+ Create Invoice / Expense&rdquo; tab above to generate an invoice.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          {inv.docType} #{inv.invoiceNumber}
                        </span>
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {inv.clientName}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : inv.status === 'Overdue'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {inv.clientEmail} · Due: {inv.dueDate} · Total: {inv.currency}{' '}
                        {Number(inv.totalAmount || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={inv.status}
                        onChange={async (e) => {
                          const res = await saveEngineRecord<WorkspaceInvoiceItem>('invoices', {
                            ...inv,
                            status: e.target.value as any,
                          });
                          setInvoices(res.items);
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Paid">Paid</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = await deleteEngineRecord<WorkspaceInvoiceItem>(
                            'invoices',
                            inv.id
                          );
                          setInvoices(updated);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'expenses' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {expenses.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-sm font-medium text-slate-700">No expenses recorded yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Use the &ldquo;+ Create Invoice / Expense&rdquo; tab above to log an expense.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                          {exp.category}
                        </span>
                        <p className="text-sm font-semibold text-slate-900">{exp.title}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {exp.vendor ? `Vendor: ${exp.vendor} · ` : ''}Date: {exp.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-rose-600">
                        -{exp.currency} {Number(exp.amount || 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = await deleteEngineRecord<WorkspaceExpenseItem>(
                            'expenses',
                            exp.id
                          );
                          setExpenses(updated);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'create_finance' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setEntryMode('INVOICE')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                  entryMode === 'INVOICE'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                New Invoice / Quotation
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('EXPENSE')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                  entryMode === 'EXPENSE'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Record Expense
              </button>
            </div>

            {entryMode === 'INVOICE' ? (
              <form onSubmit={handleSaveInvoice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    >
                      <option value="INVOICE">Invoice</option>
                      <option value="QUOTATION">Quotation / Estimate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Invoice #
                    </label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Paid">Paid</option>
                      <option value="Draft">Draft</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Client Email
                    </label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="billing@client.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Line Items</span>
                    <button
                      type="button"
                      onClick={() =>
                        setItems([
                          ...items,
                          {
                            id: `item-${Date.now()}`,
                            description: '',
                            quantity: 1,
                            unitPrice: 0,
                          },
                        ])
                      }
                      className="text-xs font-semibold text-indigo-600"
                    >
                      + Add Line Item
                    </button>
                  </div>
                  {items.map((it, idx) => (
                    <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Item description"
                        value={it.description}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx].description = e.target.value;
                          setItems(next);
                        }}
                        className="col-span-6 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx].quantity = Number(e.target.value);
                          setItems(next);
                        }}
                        className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={it.unitPrice}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx].unitPrice = Number(e.target.value);
                          setItems(next);
                        }}
                        className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="col-span-1 text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-sm font-extrabold text-slate-900">
                    Total: {currency} {computedTotal.toFixed(2)}
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                  >
                    Save {docType === 'QUOTATION' ? 'Quotation' : 'Invoice'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveExpense} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Expense Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={expTitle}
                      onChange={(e) => setExpTitle(e.target.value)}
                      placeholder="e.g., Cloud Hosting & Domain Renewal"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Amount ({currency}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expAmount}
                      onChange={(e) => setExpAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Vendor</label>
                    <input
                      type="text"
                      value={expVendor}
                      onChange={(e) => setExpVendor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Printable Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                {brandLogoUrl && (
                  <img src={brandLogoUrl} alt="Company Logo" className="h-10 max-w-[110px] object-contain rounded-lg" />
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {previewInvoice.docType}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                    #{previewInvoice.invoiceNumber}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveInvoicePdf(previewInvoice)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button type="button" onClick={() => setPreviewInvoice(null)}>
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-400 font-bold">Billed To</div>
                <div className="font-bold text-slate-900">{previewInvoice.clientName}</div>
                <div className="text-slate-500">{previewInvoice.clientEmail}</div>
              </div>
              <div className="text-right">
                <div className="text-slate-400 font-bold">Due Date</div>
                <div className="font-bold text-slate-900">{previewInvoice.dueDate}</div>
                <div className="text-indigo-600 font-bold">{previewInvoice.status}</div>
              </div>
            </div>
            <div className="border-t border-b border-slate-200 py-3 space-y-2">
              {previewInvoice.items?.map((line) => (
                <div key={line.id} className="flex justify-between text-xs">
                  <span>
                    {line.description} × {line.quantity}
                  </span>
                  <span className="font-bold">
                    {previewInvoice.currency} {(line.quantity * line.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center text-sm font-extrabold text-slate-900">
              <span>Total Amount</span>
              <span>
                {previewInvoice.currency} {Number(previewInvoice.totalAmount || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      <FileManagerPickerModal
        isOpen={showLogoPicker}
        onClose={() => setShowLogoPicker(false)}
        defaultFolderId="folder-images"
        imagesOnly
        title="Select Company Logo for Invoices & Quotations"
        onSelectFile={(file) => {
          updateBrandLogo(file.url);
          setShowLogoPicker(false);
        }}
      />

      {editingLogoTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingLogoTarget)}
            target={editingLogoTarget}
            onClose={() => setEditingLogoTarget(null)}
            onSaved={(res) => {
              updateBrandLogo(res.file?.url || res.dataUrl);
              setEditingLogoTarget(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

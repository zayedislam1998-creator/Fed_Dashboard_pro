import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  LifeBuoy,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Building2,
  Mail,
  LayoutGrid,
  List as ListIcon,
  Download,
} from 'lucide-react';
import {
  WorkspaceCrmLeadItem,
  WorkspaceSupportTicketItem,
  fetchEngineCollection,
  saveEngineRecord,
  deleteEngineRecord,
} from '../services/workspaceApi';
import { convertViaEngine } from '../services/engineCache';

export type CrmSubTab = 'leads' | 'tickets' | 'create_crm';

interface CrmTicketsViewProps {
  activeSubTab?: CrmSubTab;
  onSubTabChange?: (tab: CrmSubTab) => void;
}

export const CrmTicketsView: React.FC<CrmTicketsViewProps> = ({
  activeSubTab = 'leads',
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<CrmSubTab>(activeSubTab);
  const [leads, setLeads] = useState<WorkspaceCrmLeadItem[]>([]);
  const [tickets, setTickets] = useState<WorkspaceSupportTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [leadLayout, setLeadLayout] = useState<'kanban' | 'list'>('kanban');
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [formType, setFormType] = useState<'LEAD' | 'TICKET'>('LEAD');

  const handleExportCrmXlsx = async () => {
    try {
      const res = await convertViaEngine({
        action: 'SHEETS_TO_XLSX',
        title: `CRM_Pipeline_${new Date().toISOString().slice(0, 10)}`,
        sheets: [
          {
            name: 'CRM Leads',
            columns: ['Name', 'Company', 'Email', 'Stage', 'Deal Value', 'Notes'],
            rows: leads.map((l) => [
              l.name,
              l.company,
              l.email || '',
              l.stage,
              String(l.dealValue || 0),
              l.notes || '',
            ]),
          },
          {
            name: 'Support Tickets',
            columns: ['Ticket #', 'Subject', 'Customer', 'Email', 'Priority', 'Status'],
            rows: tickets.map((t) => [
              t.ticketNumber,
              t.subject,
              t.customerName,
              t.customerEmail,
              t.priority,
              t.status,
            ]),
          },
        ],
        folderId: 'folder-documents',
      });
      setBanner(`Saved CRM Export "${res.file.name}" to Server File Manager!`);
      setTimeout(() => setBanner(null), 3500);
    } catch (err: any) {
      setBanner(err?.message || 'CRM export failed.');
    }
  };

  // Lead fields
  const [leadName, setLeadName] = useState('');
  const [company, setCompany] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [stage, setStage] = useState<WorkspaceCrmLeadItem['stage']>('New Lead');
  const [dealValue, setDealValue] = useState(0);
  const [leadNotes, setLeadNotes] = useState('');

  // Ticket fields
  const [subject, setSubject] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [priority, setPriority] = useState<WorkspaceSupportTicketItem['priority']>('Medium');
  const [description, setDescription] = useState('');

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: CrmSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [l, t] = await Promise.all([
        fetchEngineCollection<WorkspaceCrmLeadItem>('crmLeads'),
        fetchEngineCollection<WorkspaceSupportTicketItem>('supportTickets'),
      ]);
      setLeads(l);
      setTickets(t);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim()) return;
    const res = await saveEngineRecord<WorkspaceCrmLeadItem>('crmLeads', {
      name: leadName.trim(),
      company: company.trim() || 'Independent',
      email: leadEmail.trim(),
      phone: leadPhone.trim(),
      stage,
      dealValue: Number(dealValue || 0),
      assignedTo: 'Workspace Admin',
      notes: leadNotes.trim(),
    });
    setLeads(res.items);
    setBanner(`CRM Lead "${res.item.name}" saved.`);
    setTimeout(() => setBanner(null), 3000);
    setLeadName('');
    setCompany('');
    setLeadEmail('');
    setDealValue(0);
    switchTab('leads');
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    const res = await saveEngineRecord<WorkspaceSupportTicketItem>('supportTickets', {
      ticketNumber: `TKT-${Date.now().toString().slice(-5)}`,
      subject: subject.trim(),
      customerName: customerName.trim() || 'Client',
      customerEmail: customerEmail.trim(),
      priority,
      status: 'Open',
      assignedTo: 'Support Team',
      description: description.trim(),
      resolution: '',
    });
    setTickets(res.items);
    setBanner(`Support Ticket #${res.item.ticketNumber} created.`);
    setTimeout(() => setBanner(null), 3000);
    setSubject('');
    setDescription('');
    switchTab('tickets');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => switchTab('leads')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'leads'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            CRM Leads Pipeline ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('tickets')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'tickets'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Support Tickets ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('create_crm')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_crm'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Lead / Support Ticket
          </button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'leads' && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setLeadLayout('kanban')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  leadLayout === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </button>
              <button
                type="button"
                onClick={() => setLeadLayout('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                  leadLayout === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" /> List
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleExportCrmXlsx}
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

      {subTab === 'leads' && (
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading CRM leads...</div>
          ) : leads.length === 0 ? (
            <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 py-12 px-4 text-center">
              <p className="text-sm font-medium text-slate-700">No CRM leads added yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Use the &ldquo;+ Add Lead / Support Ticket&rdquo; tab above to add your first client lead.
              </p>
            </div>
          ) : leadLayout === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 min-w-[920px]">
              {(['New Lead', 'Contacted', 'Proposal Sent', 'Won', 'Lost'] as const).map((stage) => {
                const colLeads = leads.filter((l) => l.stage === stage);
                const colValue = colLeads.reduce((s, l) => s + Number(l.dealValue || 0), 0);
                return (
                  <div
                    key={stage}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async () => {
                      if (!dragLeadId) return;
                      const dragged = leads.find((l) => l.id === dragLeadId);
                      setDragLeadId(null);
                      if (!dragged || dragged.stage === stage) return;
                      const res = await saveEngineRecord<WorkspaceCrmLeadItem>('crmLeads', {
                        ...dragged,
                        stage,
                      });
                      setLeads(res.items);
                    }}
                    className="bg-slate-100/80 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2.5 min-h-[420px]"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-extrabold text-slate-800">
                        {stage} ({colLeads.length})
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">
                        ${colValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-2 flex-1">
                      {colLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDragLeadId(lead.id)}
                          className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs cursor-grab active:cursor-grabbing space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">{lead.name}</p>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-extrabold shrink-0">
                              ${Number(lead.dealValue || 0).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {lead.company}
                          </p>
                          {lead.notes && (
                            <p className="text-[10px] text-slate-400 line-clamp-2">{lead.notes}</p>
                          )}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <select
                              value={lead.stage}
                              onChange={async (e) => {
                                const res = await saveEngineRecord<WorkspaceCrmLeadItem>('crmLeads', {
                                  ...lead,
                                  stage: e.target.value as any,
                                });
                                setLeads(res.items);
                              }}
                              className="text-[10px] font-bold border border-slate-200 rounded-lg px-1.5 py-0.5 bg-white"
                            >
                              <option value="New Lead">New Lead</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Proposal Sent">Proposal Sent</option>
                              <option value="Won">Won</option>
                              <option value="Lost">Lost</option>
                            </select>
                            <button
                              type="button"
                              onClick={async () => {
                                const updated = await deleteEngineRecord<WorkspaceCrmLeadItem>('crmLeads', lead.id);
                                setLeads(updated);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {lead.company}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">
                        ${Number(lead.dealValue || 0).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <Mail className="w-3 h-3" /> {lead.email || 'No email'}
                      {lead.notes ? ` · ${lead.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={lead.stage}
                      onChange={async (e) => {
                        const res = await saveEngineRecord<WorkspaceCrmLeadItem>('crmLeads', {
                          ...lead,
                          stage: e.target.value as any,
                        });
                        setLeads(res.items);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Proposal Sent">Proposal Sent</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = await deleteEngineRecord<WorkspaceCrmLeadItem>('crmLeads', lead.id);
                        setLeads(updated);
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
      )}

      {subTab === 'tickets' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {tickets.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-sm font-medium text-slate-700">No support tickets open.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Use the &ldquo;+ Add Lead / Support Ticket&rdquo; tab above to create a ticket.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((tkt) => (
                  <div
                    key={tkt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-bold">
                          #{tkt.ticketNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tkt.priority === 'Urgent' || tkt.priority === 'High'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tkt.priority}
                        </span>
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {tkt.subject}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tkt.customerName} ({tkt.customerEmail}) · {tkt.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={tkt.status}
                        onChange={async (e) => {
                          const res = await saveEngineRecord<WorkspaceSupportTicketItem>(
                            'supportTickets',
                            {
                              ...tkt,
                              status: e.target.value as any,
                            }
                          );
                          setTickets(res.items);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = await deleteEngineRecord<WorkspaceSupportTicketItem>(
                            'supportTickets',
                            tkt.id
                          );
                          setTickets(updated);
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

      {subTab === 'create_crm' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setFormType('LEAD')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                  formType === 'LEAD' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                New CRM Client Lead
              </button>
              <button
                type="button"
                onClick={() => setFormType('TICKET')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold ${
                  formType === 'TICKET' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                New Support Ticket
              </button>
            </div>

            {formType === 'LEAD' ? (
              <form onSubmit={handleSaveLead} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Company</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Estimated Deal Value ($)
                    </label>
                    <input
                      type="number"
                      value={dealValue}
                      onChange={(e) => setDealValue(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                    <textarea
                      rows={3}
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                  >
                    Save Lead
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveTicket} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Issue Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer Email
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                  >
                    Create Support Ticket
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

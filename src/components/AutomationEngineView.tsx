import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  WorkspaceAutomationRuleItem,
  fetchEngineCollection,
  saveEngineRecord,
  deleteEngineRecord,
  runAutomationWorkflow,
} from '../services/workspaceApi';

export type AutomationSubTab = 'rules' | 'create_rule';

interface AutomationEngineViewProps {
  activeSubTab?: AutomationSubTab;
  onSubTabChange?: (tab: AutomationSubTab) => void;
}

export const AutomationEngineView: React.FC<AutomationEngineViewProps> = ({
  activeSubTab = 'rules',
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<AutomationSubTab>(activeSubTab);
  const [rules, setRules] = useState<WorkspaceAutomationRuleItem[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('When CMH Form is Submitted');
  const [actionType, setActionType] = useState('Send Email Notification');
  const [targetValue, setTargetValue] = useState('');

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: AutomationSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  useEffect(() => {
    fetchEngineCollection<WorkspaceAutomationRuleItem>('automationRules')
      .then(setRules)
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await saveEngineRecord<WorkspaceAutomationRuleItem>('automationRules', {
      name: name.trim(),
      triggerEvent,
      actionType,
      targetValue: targetValue.trim() || 'Admin / Default Target',
      isActive: true,
      runsCount: 0,
    });
    setRules(res.items);
    setBanner(`Workflow rule "${res.item.name}" activated.`);
    setTimeout(() => setBanner(null), 3000);
    setName('');
    setTargetValue('');
    switchTab('rules');
  };

  const handleTestRun = async (rule: WorkspaceAutomationRuleItem) => {
    try {
      const res = await runAutomationWorkflow(rule.id);
      setRules(res.items);
      setBanner(res.effectSummary || `Executed workflow "${rule.name}" (${rule.triggerEvent} → ${rule.actionType}).`);
    } catch (err: any) {
      setBanner(err?.message || `Failed to run "${rule.name}".`);
    }
    setTimeout(() => setBanner(null), 4000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => switchTab('rules')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'rules'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Automation Workflows ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => switchTab('create_rule')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'create_rule'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Workflow Rule
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

      {subTab === 'rules' ? (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-6xl mx-auto bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {rules.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No automation workflows configured yet.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Use the &ldquo;+ Create Workflow Rule&rdquo; tab above to automate tasks, webhooks, and email alerts.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rule.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {rule.isActive ? 'ACTIVE' : 'PAUSED'}
                        </span>
                        <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold">
                          IF: {rule.triggerEvent}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                          THEN: {rule.actionType} ({rule.targetValue})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          · Runs: {rule.runsCount || 0}
                          {rule.lastRunAt ? ` · Last: ${rule.lastRunAt}` : ''}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTestRun(rule)}
                        className="px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Test Run
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await saveEngineRecord<WorkspaceAutomationRuleItem>(
                            'automationRules',
                            { ...rule, isActive: !rule.isActive }
                          );
                          setRules(res.items);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
                      >
                        {rule.isActive ? 'Pause' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = await deleteEngineRecord<WorkspaceAutomationRuleItem>(
                            'automationRules',
                            rule.id
                          );
                          setRules(updated);
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
      ) : (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <form
            onSubmit={handleSave}
            className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">
              Create Trigger → Action Workflow Rule
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Workflow Rule Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Auto-Notify Support Lead on New Ticket"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WHEN (Trigger Event)
                </label>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="When CMH Form is Submitted">When CMH Form is Submitted</option>
                  <option value="When New CMH Project is Created">
                    When New CMH Project is Created
                  </option>
                  <option value="When New CMH Task is Assigned">
                    When New CMH Task is Assigned
                  </option>
                  <option value="When New Support Ticket is Opened">
                    When New Support Ticket is Opened
                  </option>
                  <option value="When New CRM Lead is Added">When New CRM Lead is Added</option>
                  <option value="When Invoice Becomes Overdue">
                    When Invoice Becomes Overdue
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  THEN (Action to Execute)
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="Send Email Notification">Send Email Notification</option>
                  <option value="Trigger Outgoing Webhook POST">
                    Trigger Outgoing Webhook POST
                  </option>
                  <option value="Create Follow-up CMH Task">Create Follow-up CMH Task</option>
                  <option value="Post Alert to Team Chat Channel">
                    Post Alert to Team Chat Channel
                  </option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Recipient Email / Webhook URL / Channel Name
              </label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g., admin@company.com or https://api.yoursite.com/webhook"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold"
              >
                Activate Workflow Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

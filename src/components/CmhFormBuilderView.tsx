import React, { useState, useEffect, useMemo } from 'react';
import {
  Blocks,
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Edit3,
  Eye,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Globe,
  Lock,
  UserPlus,
  BellRing,
  Mail,
  ShieldCheck,
  Sparkles,
  FileSpreadsheet,
  Sliders,
  Columns,
  Square,
  X,
  CheckCircle2,
  Loader2,
  Type,
  User,
  KeyRound,
  Phone,
  MapPin,
  AlignLeft,
  Hash,
  ListFilter,
  CheckSquare,
  Calendar,
  Clock,
  Upload,
  Star,
  Layers,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { convertViaEngine } from '../services/engineCache';
import {
  CmhFormTemplate,
  CmhFormField,
  CmhFieldType,
  CmhFormCategory,
  CmhNotificationRules,
  CmhSubmission,
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  COUNTRY_DIAL_CODES,
  COUNTRY_STATE_CITY_DIRECTORY,
  fetchCmhWorkspaceBootstrap,
  saveCmhFormTemplate,
  deleteCmhFormTemplate,
  saveCmhNotificationRules,
} from '../services/workspaceApi';
import { CmhDynamicFieldsRenderer } from './CmhDynamicFieldsRenderer';
import { CmhMemberInviteModal } from './CmhMemberInviteModal';
import { CmhFormFieldsEditorModal } from './CmhFormFieldsEditorModal';

export type CmhFormBuilderSubTab = 'all_forms' | 'builder' | 'rules';

interface CmhFormBuilderViewProps {
  activeSubTab?: CmhFormBuilderSubTab;
  onSubTabChange?: (tab: CmhFormBuilderSubTab) => void;
  searchQuery?: string;
  onOpenPublicCmhPreview?: (param: string) => void;
}

const FIELD_PALETTE: Array<{
  type: CmhFieldType;
  label: string;
  defaultLabel: string;
  placeholder?: string;
  defaultWidth: 'full' | 'half';
  defaultOptions?: string[];
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
}> = [
  {
    type: 'FULL_NAME',
    label: 'Full Name',
    defaultLabel: 'Full Name',
    placeholder: 'Enter your full name',
    defaultWidth: 'half',
    icon: User,
    badge: 'Identity',
  },
  {
    type: 'EMAIL',
    label: 'Email Address',
    defaultLabel: 'Email Address',
    placeholder: 'name@company.com',
    defaultWidth: 'half',
    icon: Mail,
    badge: 'Identity',
  },
  {
    type: 'PASSWORD',
    label: 'Password',
    defaultLabel: 'Account Password',
    placeholder: 'Enter strong password',
    defaultWidth: 'half',
    icon: KeyRound,
    badge: 'Auth',
  },
  {
    type: 'PHONE_WITH_CODE',
    label: 'Phone + Dial Code',
    defaultLabel: 'Phone Number (with Country Code)',
    placeholder: '1712-345678',
    defaultWidth: 'half',
    icon: Phone,
    badge: 'Global',
  },
  {
    type: 'COUNTRY_STATE_CITY',
    label: 'Country, State & City',
    defaultLabel: 'Country, State / Division & City',
    defaultWidth: 'full',
    icon: MapPin,
    badge: 'Cascading',
  },
  {
    type: 'ADDRESS',
    label: 'Street Address',
    defaultLabel: 'Street Address / Office Location',
    placeholder: 'House, Road, Block, Postal Code',
    defaultWidth: 'full',
    icon: MapPin,
    badge: 'Location',
  },
  {
    type: 'SHORT_TEXT',
    label: 'Short Text',
    defaultLabel: 'Short Answer',
    placeholder: 'Type your answer...',
    defaultWidth: 'half',
    icon: Type,
    badge: 'Text',
  },
  {
    type: 'PARAGRAPH',
    label: 'Paragraph / Notes',
    defaultLabel: 'Detailed Description & Notes',
    placeholder: 'Write detailed notes or specifications...',
    defaultWidth: 'full',
    icon: AlignLeft,
    badge: 'Long Text',
  },
  {
    type: 'NUMBER',
    label: 'Number / Budget',
    defaultLabel: 'Amount / Estimated Hours',
    placeholder: 'e.g. 5000',
    defaultWidth: 'half',
    icon: Hash,
    badge: 'Numeric',
  },
  {
    type: 'DROPDOWN',
    label: 'Dropdown Menu',
    defaultLabel: 'Select Category',
    defaultWidth: 'half',
    defaultOptions: ['Engineering & Dev', 'Product & Design', 'Operations', 'Marketing'],
    icon: ListFilter,
    badge: 'Select',
  },
  {
    type: 'STATUS_SELECT',
    label: 'Status Selector',
    defaultLabel: 'Current Status',
    defaultWidth: 'half',
    defaultOptions: ['To Do', 'In Progress', 'Under Review', 'Completed'],
    icon: CheckCircle2,
    badge: 'Workflow',
  },
  {
    type: 'PRIORITY_SELECT',
    label: 'Priority Selector',
    defaultLabel: 'Priority Level',
    defaultWidth: 'half',
    defaultOptions: ['Low', 'Medium', 'High', 'Critical'],
    icon: Sliders,
    badge: 'Workflow',
  },
  {
    type: 'SINGLE_CHOICE',
    label: 'Single Choice',
    defaultLabel: 'Select One Option',
    defaultWidth: 'full',
    defaultOptions: ['Option A', 'Option B', 'Option C'],
    icon: CheckCircle2,
    badge: 'Radio',
  },
  {
    type: 'MULTI_CHOICE',
    label: 'Multi Checkboxes',
    defaultLabel: 'Select All That Apply',
    defaultWidth: 'full',
    defaultOptions: ['Requirement 1', 'Requirement 2', 'Requirement 3'],
    icon: CheckSquare,
    badge: 'Multi',
  },
  {
    type: 'DATE',
    label: 'Date Picker',
    defaultLabel: 'Target Date / Deadline',
    defaultWidth: 'half',
    icon: Calendar,
    badge: 'Date',
  },
  {
    type: 'TIME',
    label: 'Time Picker',
    defaultLabel: 'Preferred Time',
    defaultWidth: 'half',
    icon: Clock,
    badge: 'Time',
  },
  {
    type: 'FILE_UPLOAD',
    label: 'Server File Upload',
    defaultLabel: 'Upload Attachment / Screenshot',
    defaultWidth: 'full',
    icon: Upload,
    badge: 'Auto-Compress',
  },
  {
    type: 'RATING',
    label: 'Star Rating (1-5)',
    defaultLabel: 'Quality / Priority Rating',
    defaultWidth: 'half',
    icon: Star,
    badge: '1-5 Stars',
  },
  {
    type: 'TERMS_CHECKBOX',
    label: 'Terms Agreement',
    defaultLabel: 'Confirmation & Terms',
    placeholder: 'I confirm that the information provided above is accurate.',
    defaultWidth: 'full',
    icon: ShieldCheck,
    badge: 'Consent',
  },
  {
    type: 'PAGE_BREAK',
    label: 'Page / Step Break',
    defaultLabel: 'Next Step / Section',
    defaultWidth: 'full',
    icon: Layers,
    badge: 'Multi-Step',
  },
];

const FORM_CATEGORY_BADGES: Record<
  CmhFormCategory,
  { label: string; bg: string; text: string; border: string }
> = {
  TASK: {
    label: 'Task Form',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  PROJECT: {
    label: 'Project Form',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  REGISTRATION: {
    label: 'Registration Form',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  LOGIN: {
    label: 'Login Form',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  GENERAL: {
    label: 'General Form',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
};

export const CmhFormBuilderView: React.FC<CmhFormBuilderViewProps> = ({
  activeSubTab = 'all_forms',
  onSubTabChange,
  searchQuery = '',
  onOpenPublicCmhPreview,
}) => {
  const [subTab, setSubTab] = useState<CmhFormBuilderSubTab>(activeSubTab);
  const [forms, setForms] = useState<CmhFormTemplate[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [teamGroups, setTeamGroups] = useState<WorkspaceTeamGroup[]>([]);
  const [rules, setRules] = useState<CmhNotificationRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filter in All Built Forms
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Submissions Inspector Modal
  const [inspectingForm, setInspectingForm] = useState<CmhFormTemplate | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<CmhSubmission | null>(null);

  // Member Invite Modal
  const [inviteModalForm, setInviteModalForm] = useState<CmhFormTemplate | null>(null);

  // Builder State
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('New Custom Task / Registration Form');
  const [formDescription, setFormDescription] = useState(
    'Complete the fields below. Submitting automatically notifies the Admin and delivers a real-time report to the Primary Inbox.'
  );
  const [formCategory, setFormCategory] = useState<CmhFormCategory>('TASK');
  const [accessMode, setAccessMode] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [submitButtonLabel, setSubmitButtonLabel] = useState('Submit Response');
  const [confirmationMessage, setConfirmationMessage] = useState(
    'Thank you! Your response has been recorded and delivered to the Admin Inbox.'
  );
  const [fields, setFields] = useState<CmhFormField[]>([
    {
      id: 'f-name',
      label: 'Full Name',
      type: 'FULL_NAME',
      placeholder: 'Enter your full name',
      required: true,
      width: 'half',
    },
    {
      id: 'f-email',
      label: 'Email Address',
      type: 'EMAIL',
      placeholder: 'you@company.com',
      required: true,
      width: 'half',
    },
    {
      id: 'f-phone',
      label: 'Phone Number (with Country Code)',
      type: 'PHONE_WITH_CODE',
      placeholder: '1712-345678',
      required: true,
      width: 'half',
      defaultCountryCode: '+880',
    },
    {
      id: 'f-status',
      label: 'Execution Status',
      type: 'STATUS_SELECT',
      required: true,
      width: 'half',
      options: ['To Do', 'In Progress', 'Review', 'Completed'],
    },
    {
      id: 'f-location',
      label: 'Country, State / Division & City',
      type: 'COUNTRY_STATE_CITY',
      required: false,
      width: 'full',
      defaultCountry: 'Bangladesh',
    },
    {
      id: 'f-notes',
      label: 'Detailed Notes / Deliverables',
      type: 'PARAGRAPH',
      placeholder: 'Describe progress, blockers, or requirements...',
      required: true,
      width: 'full',
    },
  ]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>('f-name');
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});
  const [isFieldsEditorOpen, setIsFieldsEditorOpen] = useState(false);

  useEffect(() => {
    setSubTab(activeSubTab);
  }, [activeSubTab]);

  const switchTab = (tab: CmhFormBuilderSubTab) => {
    setSubTab(tab);
    onSubTabChange?.(tab);
  };

  const loadBootstrap = async () => {
    setLoading(true);
    try {
      const data = await fetchCmhWorkspaceBootstrap();
      setForms(data.forms);
      setMembers(data.members);
      setTeamGroups(data.teamGroups);
      setRules(data.rules);
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setStatusBanner({ type, message });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const getShareUrl = (formId: string) => {
    return `${window.location.origin}/?cmh=form:${encodeURIComponent(formId)}`;
  };

  const handleCopyLink = (formId: string) => {
    navigator.clipboard.writeText(getShareUrl(formId));
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('success', 'Individual form link copied to clipboard.');
  };

  const applyPreset = (preset: CmhFormCategory) => {
    setEditingFormId(null);
    setFormCategory(preset);
    setPreviewValues({});
    if (preset === 'LOGIN') {
      setFormTitle('Member & Client Portal Login Form');
      setFormDescription('Sign in with your registered email address and password.');
      setSubmitButtonLabel('Sign In to Portal');
      setConfirmationMessage('Login verification submitted.');
      const nextFields: CmhFormField[] = [
        {
          id: `fld-${Date.now()}-1`,
          label: 'Email Address',
          type: 'EMAIL',
          placeholder: 'name@company.com',
          required: true,
          width: 'full',
        },
        {
          id: `fld-${Date.now()}-2`,
          label: 'Account Password',
          type: 'PASSWORD',
          placeholder: 'Enter your password',
          required: true,
          width: 'full',
        },
        {
          id: `fld-${Date.now()}-3`,
          label: 'Session Verification',
          type: 'TERMS_CHECKBOX',
          placeholder: 'Keep me signed in on this trusted device',
          required: false,
          width: 'full',
        },
      ];
      setFields(nextFields);
      setSelectedFieldId(nextFields[0].id);
    } else if (preset === 'REGISTRATION') {
      setFormTitle('Global Member & Partner Registration Form');
      setFormDescription(
        'Complete your profile with phone country code and Country / State / City details.'
      );
      setSubmitButtonLabel('Complete Registration');
      setConfirmationMessage('Registration submitted! Admin has been notified in real time.');
      const nextFields: CmhFormField[] = [
        {
          id: `fld-${Date.now()}-1`,
          label: 'Full Name',
          type: 'FULL_NAME',
          placeholder: 'Enter full legal name',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-2`,
          label: 'Official Email Address',
          type: 'EMAIL',
          placeholder: 'you@domain.com',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-3`,
          label: 'Create Password',
          type: 'PASSWORD',
          placeholder: 'Minimum 8 characters',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-4`,
          label: 'Phone Number (with Country Code)',
          type: 'PHONE_WITH_CODE',
          placeholder: '1712-345678',
          required: true,
          width: 'half',
          defaultCountryCode: '+880',
        },
        {
          id: `fld-${Date.now()}-5`,
          label: 'Country, State / Division & City',
          type: 'COUNTRY_STATE_CITY',
          required: true,
          width: 'full',
          defaultCountry: 'Bangladesh',
        },
        {
          id: `fld-${Date.now()}-6`,
          label: 'Street Address / Office Location',
          type: 'ADDRESS',
          placeholder: 'House, Road, Sector, Postal Code',
          required: false,
          width: 'full',
        },
        {
          id: `fld-${Date.now()}-7`,
          label: 'Department / Role',
          type: 'DROPDOWN',
          required: true,
          width: 'half',
          options: ['Engineering & Dev', 'Product & Design', 'Operations & HR', 'Executive'],
        },
        {
          id: `fld-${Date.now()}-8`,
          label: 'Upload Profile Photo / ID Document',
          type: 'FILE_UPLOAD',
          required: false,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-9`,
          label: 'Terms & Conditions',
          type: 'TERMS_CHECKBOX',
          placeholder: 'I agree to the Workspace Rules & Privacy Policy.',
          required: true,
          width: 'full',
        },
      ];
      setFields(nextFields);
      setSelectedFieldId(nextFields[0].id);
    } else if (preset === 'TASK') {
      setFormTitle('Standard Task Execution & Deliverable Form');
      setFormDescription('Used when creating and submitting Tasks in the CMH Tasks module.');
      setSubmitButtonLabel('Submit Task Update');
      setConfirmationMessage('Task update recorded and sent to Admin Primary Inbox.');
      const nextFields: CmhFormField[] = [
        {
          id: `fld-${Date.now()}-1`,
          label: 'Assignee Full Name',
          type: 'FULL_NAME',
          placeholder: 'Enter your full name',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-2`,
          label: 'Contact Phone (with Country Code)',
          type: 'PHONE_WITH_CODE',
          placeholder: '1712-345678',
          required: false,
          width: 'half',
          defaultCountryCode: '+880',
        },
        {
          id: `fld-${Date.now()}-3`,
          label: 'Task Execution Status',
          type: 'STATUS_SELECT',
          required: true,
          width: 'half',
          options: ['To Do', 'In Progress', 'Review', 'Completed'],
        },
        {
          id: `fld-${Date.now()}-4`,
          label: 'Priority Level',
          type: 'PRIORITY_SELECT',
          required: true,
          width: 'half',
          options: ['Low', 'Medium', 'High', 'Critical'],
        },
        {
          id: `fld-${Date.now()}-5`,
          label: 'Estimated Hours / Story Points',
          type: 'NUMBER',
          placeholder: 'e.g. 8',
          required: false,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-6`,
          label: 'Target Completion Date',
          type: 'DATE',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-7`,
          label: 'Deliverable Summary & Notes',
          type: 'PARAGRAPH',
          placeholder: 'Detail what was completed, links, or blockers...',
          required: true,
          width: 'full',
        },
        {
          id: `fld-${Date.now()}-8`,
          label: 'Deliverable File / Screenshot Upload',
          type: 'FILE_UPLOAD',
          required: false,
          width: 'full',
        },
      ];
      setFields(nextFields);
      setSelectedFieldId(nextFields[0].id);
    } else if (preset === 'PROJECT') {
      setFormTitle('Enterprise Project Blueprint & Milestone Form');
      setFormDescription('Used when launching or updating Projects in the CMH Projects module.');
      setSubmitButtonLabel('Submit Project Report');
      setConfirmationMessage('Project milestone submitted and emailed to Admin.');
      const nextFields: CmhFormField[] = [
        {
          id: `fld-${Date.now()}-1`,
          label: 'Project Lead / Stakeholder Name',
          type: 'FULL_NAME',
          placeholder: 'Enter lead name',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-2`,
          label: 'Stakeholder Phone',
          type: 'PHONE_WITH_CODE',
          placeholder: '1700-000000',
          required: true,
          width: 'half',
          defaultCountryCode: '+880',
        },
        {
          id: `fld-${Date.now()}-3`,
          label: 'Client / Deployment Location',
          type: 'COUNTRY_STATE_CITY',
          required: true,
          width: 'full',
          defaultCountry: 'Bangladesh',
        },
        {
          id: `fld-${Date.now()}-4`,
          label: 'Project Phase',
          type: 'DROPDOWN',
          required: true,
          width: 'half',
          options: [
            'Discovery & Architecture',
            'Active Development',
            'QA & Staging',
            'Production Launch',
          ],
        },
        {
          id: `fld-${Date.now()}-5`,
          label: 'Allocated Budget (USD)',
          type: 'NUMBER',
          placeholder: 'e.g. 15000',
          required: false,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-6`,
          label: 'Executive Summary & Milestones',
          type: 'PARAGRAPH',
          placeholder: 'Outline key deliverables and timeline...',
          required: true,
          width: 'full',
        },
        {
          id: `fld-${Date.now()}-7`,
          label: 'Upload Project Specification / Asset',
          type: 'FILE_UPLOAD',
          required: false,
          width: 'full',
        },
      ];
      setFields(nextFields);
      setSelectedFieldId(nextFields[0].id);
    } else {
      setFormTitle('General Feedback & Intake Form');
      setFormDescription('Share your feedback or request with our team.');
      setSubmitButtonLabel('Submit Form');
      const nextFields: CmhFormField[] = [
        {
          id: `fld-${Date.now()}-1`,
          label: 'Full Name',
          type: 'FULL_NAME',
          placeholder: 'Your name',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-2`,
          label: 'Email Address',
          type: 'EMAIL',
          placeholder: 'you@example.com',
          required: true,
          width: 'half',
        },
        {
          id: `fld-${Date.now()}-3`,
          label: 'Your Message',
          type: 'PARAGRAPH',
          placeholder: 'Write your message here...',
          required: true,
          width: 'full',
        },
      ];
      setFields(nextFields);
      setSelectedFieldId(nextFields[0].id);
    }
  };

  const handleAddField = (paletteItem: (typeof FIELD_PALETTE)[number]) => {
    const newField: CmhFormField = {
      id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: paletteItem.defaultLabel,
      type: paletteItem.type,
      placeholder: paletteItem.placeholder,
      required: paletteItem.type === 'FULL_NAME' || paletteItem.type === 'EMAIL',
      width: paletteItem.defaultWidth,
      options: paletteItem.defaultOptions ? [...paletteItem.defaultOptions] : undefined,
      defaultCountryCode: paletteItem.type === 'PHONE_WITH_CODE' ? '+880' : undefined,
      defaultCountry: paletteItem.type === 'COUNTRY_STATE_CITY' ? 'Bangladesh' : undefined,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const handleUpdateField = (id: string, patch: Partial<CmhFormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...f, ...patch } : f)));
  };

  const handleDeleteField = (id: string) => {
    if (fields.length <= 1) {
      showToast('error', 'A form must contain at least one field.');
      return;
    }
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    if (selectedFieldId === id) {
      setSelectedFieldId(next[0]?.id || null);
    }
  };

  const handleMoveField = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const copy = [...fields];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setFields(copy);
  };

  const handleDropOnCanvas = (targetIndex: number) => {
    if (draggedFieldIndex === null || draggedFieldIndex === targetIndex) {
      setDraggedFieldIndex(null);
      return;
    }
    const copy = [...fields];
    const [moved] = copy.splice(draggedFieldIndex, 1);
    copy.splice(targetIndex, 0, moved);
    setFields(copy);
    setDraggedFieldIndex(null);
  };

  const handleEditFormInBuilder = (form: CmhFormTemplate) => {
    setEditingFormId(form.id);
    setFormTitle(form.title);
    setFormDescription(form.description);
    setFormCategory(form.formCategory);
    setAccessMode(form.accessMode);
    setSubmitButtonLabel(form.submitButtonLabel || 'Submit Response');
    setConfirmationMessage(
      form.confirmationMessage || 'Thank you! Your response has been recorded.'
    );
    setFields(form.fields || []);
    setSelectedFieldId(form.fields?.[0]?.id || null);
    setPreviewValues({});
    switchTab('builder');
  };

  const handleSaveFormTemplate = async () => {
    if (!formTitle.trim()) {
      showToast('error', 'Please enter a form title.');
      return;
    }
    setSaving(true);
    try {
      const res = await saveCmhFormTemplate({
        id: editingFormId || undefined,
        title: formTitle.trim(),
        description: formDescription.trim(),
        formCategory,
        accessMode,
        submitButtonLabel: submitButtonLabel.trim() || 'Submit Response',
        confirmationMessage: confirmationMessage.trim(),
        fields,
      });
      setForms(res.forms);
      setEditingFormId(res.form.id);
      showToast(
        'success',
        `Form "${res.form.title}" saved! Available in Tasks, Projects, and via shareable link.`
      );
      switchTab('all_forms');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save form template.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccessModeQuick = async (form: CmhFormTemplate) => {
    const nextMode = form.accessMode === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    try {
      const res = await saveCmhFormTemplate({
        ...form,
        accessMode: nextMode,
      });
      setForms(res.forms);
      showToast(
        'success',
        `Form "${form.title}" is now ${
          nextMode === 'PUBLIC' ? 'Public (Anyone with link)' : 'Private (Invited Members only)'
        }.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update access mode.');
    }
  };

  const handleDeleteForm = async (form: CmhFormTemplate) => {
    try {
      const next = await deleteCmhFormTemplate(form.id);
      setForms(next);
      showToast('success', `Form "${form.title}" removed.`);
    } catch {
      showToast('error', 'Failed to delete form.');
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules) return;
    setSavingRules(true);
    try {
      const updated = await saveCmhNotificationRules(rules);
      setRules(updated);
      showToast(
        'success',
        `Notification & Admin Email Rules saved for ${updated.adminEmail}.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save notification rules.');
    } finally {
      setSavingRules(false);
    }
  };

  const filteredForms = useMemo(() => {
    const q = (searchQuery || localSearch).trim().toLowerCase();
    return forms.filter((f) => {
      if (categoryFilter !== 'ALL' && f.formCategory !== categoryFilter) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.formCategory.toLowerCase().includes(q)
      );
    });
  }, [forms, categoryFilter, searchQuery, localSearch]);

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedFieldId) || null,
    [fields, selectedFieldId]
  );

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Sub-Navigation Bar */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => switchTab('all_forms')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'all_forms'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            All Forms ({forms.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingFormId(null);
              switchTab('builder');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'builder'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create Form / Builder
          </button>
          <button
            type="button"
            onClick={() => switchTab('rules')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subTab === 'rules'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            Notification Rules
          </button>
        </div>
      </div>

      {/* Status Toast */}
      {statusBanner && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {statusBanner.message}
          </span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: ALL BUILT FORMS */}
      {subTab === 'all_forms' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-xs font-bold text-slate-600 shrink-0">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-600 shadow-2xs"
                >
                  <option value="ALL">All Categories ({forms.length})</option>
                  <option value="TASK">Task Forms ({forms.filter((f) => f.formCategory === 'TASK').length})</option>
                  <option value="PROJECT">Project Forms ({forms.filter((f) => f.formCategory === 'PROJECT').length})</option>
                  <option value="REGISTRATION">Registration Forms ({forms.filter((f) => f.formCategory === 'REGISTRATION').length})</option>
                  <option value="LOGIN">Login Forms ({forms.filter((f) => f.formCategory === 'LOGIN').length})</option>
                  <option value="GENERAL">General Forms ({forms.filter((f) => f.formCategory === 'GENERAL').length})</option>
                </select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Filter forms by title..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Single-Line Compact Table of Built Forms */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="col-span-4">Form Title & Category</div>
                <div className="col-span-2">Access Mode</div>
                <div className="col-span-2">Fields & Invited</div>
                <div className="col-span-1 text-center">Submissions</div>
                <div className="col-span-3 text-right">Share Link · Invite · Actions</div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Loading CMH Forms...
                </div>
              ) : filteredForms.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <p className="text-sm font-medium text-slate-700">No forms match your filter.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Use the &ldquo;+ Create Form / Builder&rdquo; tab above to build a form.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredForms.map((form) => {
                    const badge =
                      FORM_CATEGORY_BADGES[form.formCategory] || FORM_CATEGORY_BADGES.GENERAL;
                    const submissionsCount = form.submissions?.length || 0;
                    const invitedCount =
                      (form.invitedMemberIds?.length || 0) + (form.invitedTeamIds?.length || 0);

                    return (
                      <div
                        key={form.id}
                        className="flex flex-col md:grid md:grid-cols-12 gap-2.5 md:gap-3 px-4 py-3.5 md:py-3 md:items-center hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="md:col-span-4 min-w-0 flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {badge.label}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {form.title}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {form.description || 'Dynamic CMH form template'}
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAccessModeQuick(form)}
                            title="Click to switch between Public (Anyone with link) and Private (Invited Members only)"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              form.accessMode === 'PUBLIC'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {form.accessMode === 'PUBLIC' ? (
                              <>
                                <Globe className="w-3.5 h-3.5" />
                                Public Link
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                Private Only
                              </>
                            )}
                          </button>
                        </div>

                        <div className="md:col-span-2 text-xs text-slate-600 flex items-center gap-1">
                          <span className="font-semibold text-slate-800">
                            {form.fields?.length || 0}
                          </span>{' '}
                          fields
                          {invitedCount > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                              {invitedCount} invited
                            </span>
                          )}
                        </div>

                        <div className="md:col-span-1 md:text-center flex items-center justify-between md:justify-center">
                          <span className="text-[11px] font-semibold text-slate-500 md:hidden">
                            Submissions:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectingForm(form);
                              setSelectedSubmission(form.submissions?.[0] || null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-800 text-xs font-bold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {submissionsCount}
                          </button>
                        </div>

                        <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-1.5 pt-1 md:pt-0 border-t border-slate-100 md:border-t-0">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(form.id)}
                            title="Copy Individual Shareable Link"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1"
                          >
                            {copiedId === form.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Link
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setInviteModalForm(form)}
                            title="Invite Workspace Members or Team Groups & Send Link via Email"
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Invite
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenPublicCmhPreview?.(`form:${form.id}`)}
                            title="Open Interactive Form Portal"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditFormInBuilder(form)}
                            title="Edit in Drag & Drop Builder"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteForm(form)}
                            title="Delete Form"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRAG & DROP BUILDER */}
      {subTab === 'builder' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Clean Light Builder Action Bar */}
          <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => switchTab('all_forms')}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                title="Back to All Forms"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Form Type:</span>
                <select
                  value={formCategory}
                  onChange={(e) => {
                    const cat = e.target.value as CmhFormCategory;
                    setFormCategory(cat);
                    if (!editingFormId) applyPreset(cat);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="TASK">Task Form</option>
                  <option value="PROJECT">Project Form</option>
                  <option value="REGISTRATION">Registration Form</option>
                  <option value="LOGIN">Login Form</option>
                  <option value="GENERAL">General Survey / Intake</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFieldsEditorOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                Customize in Modal Editor
              </button>

              <button
                type="button"
                onClick={handleSaveFormTemplate}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {editingFormId ? 'Update Form Template' : 'Save & Publish Form'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3-Column Builder Workspace: Palette (Left) | Drag & Drop Canvas (Center) | Live Preview & Inspector (Right) */}
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            {/* LEFT: Field Palette */}
            <div className="col-span-3 bg-white border-r border-slate-200 overflow-y-auto p-4 space-y-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Add or Drag Fields ({FIELD_PALETTE.length} Types)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click any field block below to add it to your form canvas
                </p>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {FIELD_PALETTE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleAddField(item)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left flex items-center justify-between group transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 flex items-center justify-center shrink-0 transition-colors">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {item.label}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold shrink-0">
                        {item.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CENTER: Drag & Drop Form Canvas + Field Properties */}
            <div className="col-span-5 bg-[#F8FAFC] border-r border-slate-200 overflow-y-auto p-5 space-y-4">
              {/* Form Metadata Header Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-8">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Form Title *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Form Type / Module
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as CmhFormCategory)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-600"
                    >
                      <option value="TASK">Task Form (CMH Tasks)</option>
                      <option value="PROJECT">Project Form (CMH Projects)</option>
                      <option value="REGISTRATION">Registration Form</option>
                      <option value="LOGIN">Login Form</option>
                      <option value="GENERAL">General Form</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Description / Instructions
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Link Access Permission
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAccessMode('PUBLIC')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                          accessMode === 'PUBLIC'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Public Link
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccessMode('PRIVATE')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                          accessMode === 'PRIVATE'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Private Only
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Submit Button Text
                    </label>
                    <input
                      type="text"
                      value={submitButtonLabel}
                      onChange={(e) => setSubmitButtonLabel(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Drag & Drop Canvas List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Drag & Drop Form Fields ({fields.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Drag rows by handle or click to edit properties
                  </span>
                </div>

                {fields.map((field, index) => {
                  const isSelected = field.id === selectedFieldId;
                  return (
                    <div
                      key={field.id}
                      draggable
                      onDragStart={() => setDraggedFieldIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropOnCanvas(index)}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`rounded-xl border p-3.5 bg-white transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 ring-2 ring-blue-500/15 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {field.type}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {field.label}
                          </span>
                          {field.required && (
                            <span className="text-[10px] font-bold text-rose-600">*Required</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateField(field.id, {
                                width: field.width === 'full' ? 'half' : 'full',
                              });
                            }}
                            title="Toggle 50% Half Width / 100% Full Width"
                            className="px-2 py-0.5 rounded border border-slate-200 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                          >
                            {field.width === 'half' ? (
                              <>
                                <Columns className="w-3 h-3" /> 50%
                              </>
                            ) : (
                              <>
                                <Square className="w-3 h-3" /> 100%
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveField(index, -1);
                            }}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveField(index, 1);
                            }}
                            disabled={index === fields.length - 1}
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteField(field.id);
                            }}
                            className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Editor when Selected */}
                      {isSelected && selectedField && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 pt-3 border-t border-slate-100 space-y-2.5"
                        >
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Field Label
                              </label>
                              <input
                                type="text"
                                value={selectedField.label}
                                onChange={(e) =>
                                  handleUpdateField(selectedField.id, { label: e.target.value })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Placeholder / Hint
                              </label>
                              <input
                                type="text"
                                value={selectedField.placeholder || ''}
                                onChange={(e) =>
                                  handleUpdateField(selectedField.id, {
                                    placeholder: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                          </div>

                          {/* Default Country Dial Code selector for PHONE_WITH_CODE */}
                          {selectedField.type === 'PHONE_WITH_CODE' && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Default Country Dial Code
                              </label>
                              <select
                                value={selectedField.defaultCountryCode || '+880'}
                                onChange={(e) =>
                                  handleUpdateField(selectedField.id, {
                                    defaultCountryCode: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                              >
                                {COUNTRY_DIAL_CODES.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.country}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Default Country selector for COUNTRY_STATE_CITY */}
                          {selectedField.type === 'COUNTRY_STATE_CITY' && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Default Selected Country
                              </label>
                              <select
                                value={selectedField.defaultCountry || 'Bangladesh'}
                                onChange={(e) =>
                                  handleUpdateField(selectedField.id, {
                                    defaultCountry: e.target.value,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                              >
                                {Object.keys(COUNTRY_STATE_CITY_DIRECTORY).map((country) => (
                                  <option key={country} value={country}>
                                    {country}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Options editor for Dropdown, Single Choice, Multi Choice, Status, Priority */}
                          {(selectedField.type === 'DROPDOWN' ||
                            selectedField.type === 'SINGLE_CHOICE' ||
                            selectedField.type === 'MULTI_CHOICE' ||
                            selectedField.type === 'STATUS_SELECT' ||
                            selectedField.type === 'PRIORITY_SELECT') && (
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Options (comma-separated)
                              </label>
                              <input
                                type="text"
                                value={(selectedField.options || []).join(', ')}
                                onChange={(e) =>
                                  handleUpdateField(selectedField.id, {
                                    options: e.target.value
                                      .split(',')
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedField.required}
                                onChange={(e) =>
                                  handleUpdateField(selectedField.id, {
                                    required: e.target.checked,
                                  })
                                }
                                className="w-3.5 h-3.5 rounded text-blue-600"
                              />
                              Required Field
                            </label>
                            <span className="text-[11px] text-slate-400">
                              Width: {selectedField.width === 'half' ? '50% Column' : '100% Full'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Live Interactive Real-Time Form Preview */}
            <div className="col-span-4 bg-white overflow-y-auto p-5">
              <div className="sticky top-0 bg-white pb-3 mb-4 border-b border-slate-200 flex items-center justify-between z-10">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                    Live Interactive Preview
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 truncate">{formTitle}</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  {accessMode === 'PUBLIC' ? 'Public Link' : 'Private'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <p className="text-xs text-slate-600">{formDescription}</p>
                <CmhDynamicFieldsRenderer
                  fields={fields}
                  values={previewValues}
                  onChange={(fieldId, val) =>
                    setPreviewValues((prev) => ({ ...prev, [fieldId]: val }))
                  }
                />
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      showToast(
                        'success',
                        'Preview tested! Click "Save & Publish Form" in the top bar to save.'
                      )
                    }
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
                  >
                    {submitButtonLabel || 'Submit Response'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NOTIFICATION & ADMIN EMAIL RULES */}
      {subTab === 'rules' && rules && (
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSaveRules} className="max-w-3xl mx-auto space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-blue-600" />
                    CMH Real-Time Notification & Primary Inbox Email Rules
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure how Form submissions, Task updates, and Project milestones notify the
                    Admin and deliver automated emails to the Primary Inbox.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  Active Engine
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Admin Primary Email Address (Receives All Automated Activity Emails)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={rules.adminEmail}
                    onChange={(e) => setRules({ ...rules, adminEmail: e.target.value })}
                    placeholder="admin@yourdomain.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Every time a user submits a Form, Task, or Project, an official report email is
                  delivered to this address and injected directly into your Primary Mail Inbox.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {[
                  {
                    key: 'notifyOnFormSubmit' as const,
                    title: 'Form Submissions Alert',
                    desc: 'Trigger real-time notification & admin email when any CMH Form is submitted.',
                  },
                  {
                    key: 'notifyOnTaskActivity' as const,
                    title: 'Task Creation & Updates Alert',
                    desc: 'Trigger real-time notification & admin email when any Task is created or submitted.',
                  },
                  {
                    key: 'notifyOnProjectActivity' as const,
                    title: 'Project Milestones Alert',
                    desc: 'Trigger real-time notification & admin email when any Project is created or updated.',
                  },
                  {
                    key: 'notifyOnMemberActivity' as const,
                    title: 'Member & Team Invitations Alert',
                    desc: 'Trigger real-time notification & admin email when members are invited to links.',
                  },
                  {
                    key: 'autoSendAdminEmail' as const,
                    title: 'Auto-Dispatch SMTP Email to Admin',
                    desc: 'Automatically send outgoing email via connected Server Mail SMTP to Admin.',
                  },
                  {
                    key: 'injectIntoPrimaryInbox' as const,
                    title: 'Instant Primary Inbox Delivery',
                    desc: 'Deliver activity emails directly into the Primary Inbox (Gmail & Server Mail).',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      rules[item.key]
                        ? 'bg-blue-50/50 border-blue-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rules[item.key]}
                      onChange={(e) => setRules({ ...rules, [item.key]: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-blue-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingRules}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  {savingRules ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Rules...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Notification & Email Rules
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* SUBMISSIONS INSPECTOR MODAL */}
      {inspectingForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Submissions Inspector ({inspectingForm.submissions?.length || 0} Responses)
                </span>
                <h3 className="text-base font-bold">{inspectingForm.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {(inspectingForm.submissions?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const fieldCols = (inspectingForm.fields || []).map((f) => f.label);
                      convertViaEngine({
                        action: 'SHEETS_TO_XLSX',
                        title: `${inspectingForm.title}_Submissions`,
                        sheets: [
                          {
                            name: 'Submissions',
                            columns: ['ID', 'Submitter', 'Email', 'Submitted At', ...fieldCols],
                            rows: inspectingForm.submissions.map((s) => [
                              s.id,
                              s.submitterName,
                              s.submitterEmail,
                              s.submittedAt,
                              ...(inspectingForm.fields || []).map((f) => String(s.values?.[f.id] ?? '')),
                            ]),
                          },
                        ],
                        folderId: 'folder-documents',
                      });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Export .xlsx
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectingForm(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!inspectingForm.submissions || inspectingForm.submissions.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No submissions received for this form yet. Copy the link or invite members to start
                collecting responses.
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-12 overflow-hidden">
                <div className="col-span-5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100">
                  {inspectingForm.submissions.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubmission(sub)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        selectedSubmission?.id === sub.id
                          ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {sub.submitterName}
                      </p>
                      <p className="text-[11px] text-blue-600 truncate">{sub.submitterEmail}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{sub.submittedAt}</p>
                    </button>
                  ))}
                </div>
                <div className="col-span-7 p-5 overflow-y-auto space-y-3 bg-slate-50/50">
                  {selectedSubmission ? (
                    <>
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-900">
                          {selectedSubmission.submitterName} ({selectedSubmission.submitterEmail})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Submitted on {selectedSubmission.submittedAt}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(selectedSubmission.values || {}).map(([label, val]) => (
                          <div
                            key={label}
                            className="bg-white p-3 rounded-xl border border-slate-200"
                          >
                            <p className="text-[11px] font-bold uppercase text-slate-400">
                              {label}
                            </p>
                            <p className="text-xs font-semibold text-slate-900 mt-1 break-words">
                              {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Select a submission on the left.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVITE MEMBERS / TEAMS MODAL */}
      {inviteModalForm && (
        <CmhMemberInviteModal
          isOpen={Boolean(inviteModalForm)}
          onClose={() => setInviteModalForm(null)}
          targetType="form"
          targetId={inviteModalForm.id}
          targetTitle={inviteModalForm.title}
          initialMemberIds={inviteModalForm.invitedMemberIds || []}
          initialTeamIds={inviteModalForm.invitedTeamIds || []}
          members={members}
          teamGroups={teamGroups}
          onSuccess={(res) => {
            setForms(res.forms);
            showToast(
              'success',
              `Direct form link emailed to ${res.invitedCount} member(s) & logged to Admin Inbox.`
            );
          }}
        />
      )}

      {/* VISUAL FIELD EDITOR MODAL */}
      {isFieldsEditorOpen && (
        <CmhFormFieldsEditorModal
          isOpen={isFieldsEditorOpen}
          onClose={() => setIsFieldsEditorOpen(false)}
          template={{
            id: editingFormId || `form-${Date.now()}`,
            title: formTitle,
            description: formDescription,
            formCategory,
            accessMode,
            invitedMemberIds: [],
            invitedTeamIds: [],
            submitButtonLabel,
            confirmationMessage,
            fields,
            submissions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            timestamp: Date.now(),
          }}
          onSave={(updated) => {
            setFields(updated.fields);
            setFormTitle(updated.title);
            setFormDescription(updated.description);
            setSubmitButtonLabel(updated.submitButtonLabel);
            setConfirmationMessage(updated.confirmationMessage);
            setForms((prev) =>
              prev.some((f) => f.id === updated.id)
                ? prev.map((f) => (f.id === updated.id ? updated : f))
                : [...prev, updated]
            );
            showToast('success', 'Form fields updated and synced!');
          }}
        />
      )}
    </div>
  );
};

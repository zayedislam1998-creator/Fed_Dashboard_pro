import React from 'react';
import {
  CmhFormField,
  CmhFieldType,
  CmhFormCategory,
} from '../../services/workspaceApi';
import {
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
  Type,
  Mail,
  CheckCircle2,
  Sliders,
  Columns,
  Square,
  ShieldCheck,
} from 'lucide-react';

export type CmhFormBuilderSubTab = 'all_forms' | 'builder' | 'rules';

export interface CmhFormBuilderViewProps {
  activeSubTab?: CmhFormBuilderSubTab;
  onSubTabChange?: (tab: CmhFormBuilderSubTab) => void;
  searchQuery?: string;
  onOpenPublicCmhPreview?: (param: string) => void;
}

export const FIELD_PALETTE: Array<{
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

export const FORM_CATEGORY_BADGES: Record<
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

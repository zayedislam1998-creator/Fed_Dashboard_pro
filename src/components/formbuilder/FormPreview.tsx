import React from 'react';
import { CmhFormField } from '../../services/workspaceApi';
import { CmhDynamicFieldsRenderer } from '../cmh/CmhDynamicFieldsRenderer';

interface FormPreviewProps {
  formTitle: string;
  formDescription: string;
  accessMode: 'PUBLIC' | 'PRIVATE';
  submitButtonLabel: string;
  fields: CmhFormField[];
  previewValues: Record<string, any>;
  onPreviewChange: (fieldId: string, val: any) => void;
  onSubmitTest: () => void;
}

export const FormPreview: React.FC<FormPreviewProps> = ({
  formTitle,
  formDescription,
  accessMode,
  submitButtonLabel,
  fields,
  previewValues,
  onPreviewChange,
  onSubmitTest,
}) => {
  return (
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
          onChange={(fieldId, val) => onPreviewChange(fieldId, val)}
        />
        <div className="pt-2">
          <button
            type="button"
            onClick={onSubmitTest}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
          >
            {submitButtonLabel || 'Submit Response'}
          </button>
        </div>
      </div>
    </div>
  );
};


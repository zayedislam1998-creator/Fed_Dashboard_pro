import React from 'react';
import { Lock } from 'lucide-react';

export function MemberRestrictedNotice({ moduleName }: { moduleName: string }) {
  return (
    <div className="mp-card-soft rounded-2xl p-8 text-center">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-slate-100 text-slate-500 flex items-center justify-center">
        <Lock className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-[var(--mp-text)]">{moduleName} is restricted</h3>
      <p className="text-sm text-[var(--mp-text-muted)] mt-1">
        Your Workspace Admin has not enabled this app for your account yet.
      </p>
    </div>
  );
}

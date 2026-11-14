import React, { useState } from 'react';
import {
  KeyRound,
  Mail,
  MapPin,
  Palette,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import type {
  EvaluatedCapabilitiesClient,
  MemberThemeKey,
  WorkspaceAuthUser,
} from '../../services/workspaceAuth';
import {
  updateMyMemberPreferences,
  updateMyPassword,
} from '../../services/workspaceAuth';
import {
  MemberBootstrapData,
  StatusPill,
} from './shared';

export function MemberAccountSettingsView({
  data,
  activeTheme,
  readOnlyPreview,
  onSelectTheme,
  onReload,
  onNotify,
  onUserUpdated,
}: {
  data: MemberBootstrapData;
  activeTheme: MemberThemeKey;
  readOnlyPreview?: boolean;
  onSelectTheme: (theme: MemberThemeKey) => Promise<void> | void;
  onReload: () => Promise<void>;
  onNotify: (msg: string, isError?: boolean) => void;
  onUserUpdated?: (user: WorkspaceAuthUser, caps?: EvaluatedCapabilitiesClient) => void;
}) {
  const { user, capabilities } = data;
  const [displayName, setDisplayName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const themes: Array<{ key: MemberThemeKey; label: string; desc: string; swatch: string }> = [
    { key: 'cloud', label: 'Porcelain Mist', desc: 'Clean sky-slate pastel', swatch: '#4f46e5' },
    { key: 'mint', label: 'Seafoam Calm', desc: 'Soft botanical teal pastel', swatch: '#0d9488' },
    { key: 'lavender', label: 'Pearl Iris', desc: 'Warm lavender-iris pastel', swatch: '#7c3aed' },
  ];

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyPreview || !displayName.trim()) return;
    setSaving(true);
    try {
      const res = await updateMyMemberPreferences({
        name: displayName.trim(),
        memberTheme: activeTheme,
      });
      if (res.user) onUserUpdated?.(res.user);
      await onReload();
      onNotify('Display name updated.');
    } catch (err: any) {
      onNotify(err?.message || 'Could not update display name.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyPreview || !currentPassword || newPassword.length < 6) return;
    setSaving(true);
    try {
      await updateMyPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      onNotify('Password updated securely.');
    } catch (err: any) {
      onNotify(err?.message || 'Could not update password.', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-7 space-y-5">
        {/* Profile Card */}
        <section className="mp-card-soft rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--mp-border)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--mp-accent)] text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
              {String(user.name || 'M').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--mp-text)] truncate">{user.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--mp-text-muted)] mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {user.email}
                </span>
                <StatusPill label={`${capabilities.role} · ${capabilities.presetKey}`} tone="accent" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--mp-surface-subtle)]">
              <div className="font-semibold text-[var(--mp-text-muted)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Phone
              </div>
              <div className="font-bold text-[var(--mp-text)] mt-1">
                {user.phoneNumber
                  ? `${user.phoneCountryCode || ''} ${user.phoneNumber}`
                  : 'Not provided'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--mp-surface-subtle)]">
              <div className="font-semibold text-[var(--mp-text-muted)] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Location
              </div>
              <div className="font-bold text-[var(--mp-text)] mt-1">
                {[user.addressLine, user.cityName, user.stateName, user.zipCode, user.countryName]
                  .filter(Boolean)
                  .join(', ') || 'Not provided'}
              </div>
            </div>
          </div>

          {!readOnlyPreview && (
            <form onSubmit={handleSaveName} className="pt-2 space-y-2">
              <label
                htmlFor="member-display-name"
                className="block text-xs font-bold text-[var(--mp-text)]"
              >
                Update Display Name
              </label>
              <div className="flex gap-2">
                <input
                  id="member-display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1 min-h-[42px] px-3.5 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm text-[var(--mp-text)]"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] px-4 rounded-xl text-xs font-bold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] cursor-pointer"
                >
                  Save Name
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Theme Appearance Studio */}
        <section className="mp-card-soft rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)]">
            <Palette className="w-4 h-4 text-[var(--mp-accent)]" />
            <span>Dashboard Appearance Themes</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themes.map((t) => {
              const selected = activeTheme === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onSelectTheme(t.key)}
                  className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
                    selected
                      ? 'border-[var(--mp-accent)] bg-[var(--mp-accent-soft)]'
                      : 'border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.swatch }}
                    />
                    <span className="text-xs font-bold text-[var(--mp-text)]">{t.label}</span>
                  </div>
                  <div className="text-[11px] text-[var(--mp-text-muted)] mt-1">{t.desc}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="lg:col-span-5 space-y-5">
        {/* Security & Password */}
        {!readOnlyPreview && (
          <section className="mp-card-soft rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)] mb-3">
              <KeyRound className="w-4 h-4 text-[var(--mp-accent)]" />
              <span>Change Password</span>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--mp-text-muted)] mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full min-h-[42px] px-3.5 rounded-xl border border-[var(--mp-border)] bg-[var(--mp-surface-subtle)] text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !currentPassword || newPassword.length < 6}
                className="w-full min-h-[42px] rounded-xl text-xs font-bold text-white bg-[var(--mp-accent)] hover:bg-[var(--mp-accent-hover)] disabled:opacity-50 cursor-pointer"
              >
                Update Password
              </button>
            </form>
          </section>
        )}

        {/* Workspace Access & Permissions Overview */}
        <section className="mp-card-soft rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--mp-text)]">
            <ShieldCheck className="w-4 h-4 text-[var(--mp-accent)]" />
            <span>Workspace Access &amp; Modules</span>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--mp-text-muted)] mb-2">
              Enabled Modules ({capabilities.allowedModules.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {capabilities.allowedModules.map((mod) => (
                <StatusPill key={mod} label={mod} tone="neutral" />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

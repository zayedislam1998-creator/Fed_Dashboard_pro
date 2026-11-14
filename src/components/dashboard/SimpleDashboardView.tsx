import React, { useEffect, useId, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Lock, Wand2, X } from 'lucide-react';
import {
  acceptAppInvitation,
  type EvaluatedCapabilitiesClient,
  fetchAppInvitation,
  loginWorkspaceAccount,
  type WorkspaceAuthUser,
} from '../../services/workspaceAuth';
import {
  MemberProfileGeoFields,
  type ProfileGeoFormValue,
} from '../profile/MemberProfileGeoFields';

interface SimpleDashboardViewProps {
  inviteToken?: string | null;
  onAuthenticated: (
    user: WorkspaceAuthUser,
    capabilities: EvaluatedCapabilitiesClient
  ) => void;
}

function generateSecurePassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const arr = new Uint32Array(length);
  window.crypto.getRandomValues(arr);
  const chars = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(all[arr[i] % all.length]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const INITIAL_GEO: ProfileGeoFormValue = {
  phoneCountryCode: '+1',
  phoneNumber: '',
  countryCode: 'US',
  countryName: 'United States',
  stateCode: '',
  stateName: '',
  cityName: '',
  addressLine: '',
  zipCode: '',
};

export const SimpleDashboardView: React.FC<SimpleDashboardViewProps> = ({
  inviteToken,
  onAuthenticated,
}) => {
  const uid = useId();

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Invitation Acceptance State (active only when opened via ?app-invite=...)
  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    targetRole: string;
    presetKey: string;
    invitedByName?: string;
    invitedByEmail?: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [copiedGenerated, setCopiedGenerated] = useState(false);
  const [geoValue, setGeoValue] = useState<ProfileGeoFormValue>(INITIAL_GEO);

  useEffect(() => {
    if (!inviteToken) {
      setInviteInfo(null);
      setInviteError(null);
      return;
    }
    fetchAppInvitation(inviteToken)
      .then((res) => {
        const inv = res.invitation;
        setInviteInfo(inv);
        const parts = String(inv.name || '').trim().split(/\s+/);
        setFirstName(inv.firstName || parts[0] || '');
        setLastName(inv.lastName || parts.slice(1).join(' ') || '');
        setInviteError(null);
      })
      .catch((err: any) => {
        setInviteError(err?.message || 'Invitation link is invalid or expired.');
      });
  }, [inviteToken]);

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginWorkspaceAccount(loginIdentifier.trim(), loginPassword);
      onAuthenticated(res.user, res.capabilities);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await acceptAppInvitation(inviteToken, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        password: regPassword,
        phoneCountryCode: geoValue.phoneCountryCode,
        phoneNumber: geoValue.phoneNumber.trim(),
        countryCode: geoValue.countryCode,
        countryName: geoValue.countryName,
        stateCode: geoValue.stateCode,
        stateName: geoValue.stateName,
        cityName: geoValue.cityName.trim(),
        addressLine: geoValue.addressLine.trim(),
        zipCode: geoValue.zipCode.trim(),
      });
      window.history.replaceState({}, '', window.location.pathname);
      onAuthenticated(res.user, res.capabilities);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to complete invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/25 focus:border-[#0B57D0] transition';

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-4 sm:p-6">
      <main className="w-full max-w-[420px]">
        <section
          aria-labelledby={`${uid}-signin-heading`}
          className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 space-y-6"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#0B57D0] tracking-tight">
              Workspace Pro
            </p>
            <h1
              id={`${uid}-signin-heading`}
              className="text-2xl font-bold tracking-tight text-slate-900"
              style={{ textWrap: 'balance' }}
            >
              Sign in to Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Enter your username or email and password to access your workspace.
            </p>
          </div>

          {errorMsg && !inviteToken && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSignInSubmit} className="space-y-4">
            <div>
              <label
                htmlFor={`${uid}-login-identifier`}
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Username or Email
              </label>
              <input
                id={`${uid}-login-identifier`}
                type="text"
                autoComplete="username"
                required
                autoFocus
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Enter username or email"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor={`${uid}-login-password`}
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id={`${uid}-login-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] rounded-xl bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B57D0] focus-visible:ring-offset-2"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>Sign In</span>
            </button>
          </form>
        </section>
      </main>

      {/* Invitation Onboarding Modal (active only when opened via ?app-invite= token) */}
      {inviteToken && (inviteInfo || inviteError) && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Accept Team Invitation</h2>
                <p className="text-xs text-slate-500">
                  {inviteInfo ? `Joining as ${inviteInfo.email}` : 'Invitation verification'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState({}, '', window.location.pathname);
                  setInviteInfo(null);
                  setInviteError(null);
                }}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close invitation modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteError ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                {inviteError}
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Password (min 6 characters)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setRegPassword(generateSecurePassword(14));
                        setShowPassword(true);
                        setCopiedGenerated(false);
                      }}
                      className="text-[11px] font-semibold text-[#0B57D0] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Wand2 className="w-3 h-3" /> Generate Password
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className={`${inputClass} pr-20`}
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {regPassword && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(regPassword);
                              setCopiedGenerated(true);
                              setTimeout(() => setCopiedGenerated(false), 2000);
                            } catch {
                              // ignore
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {copiedGenerated ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <MemberProfileGeoFields
                  idPrefix={uid}
                  value={geoValue}
                  onChange={setGeoValue}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] rounded-xl bg-[#0B57D0] hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition cursor-pointer"
                >
                  Complete Registration
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};



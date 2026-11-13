import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import {
  Users,
  Mail,
  Briefcase,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Phone,
  Sparkles,
  MapPin,
  Edit3,
  Camera,
} from 'lucide-react';
import {
  WorkspaceMemberItem,
  WorkspaceTeamGroup,
  fetchPublicMemberInvite,
  acceptPublicMemberInvite,
  COUNTRY_DIAL_CODES,
  COUNTRY_STATE_CITY_DIRECTORY,
} from '../services/workspaceApi';
import type { ImageEditorTarget } from './ImageEditorModal';

const ImageEditorModal = lazy(() =>
  import('./ImageEditorModal').then((m) => ({ default: m.ImageEditorModal }))
);

interface PublicMemberInviteViewProps {
  inviteId: string;
  onExitPreview?: () => void;
}

export const PublicMemberInviteView: React.FC<PublicMemberInviteViewProps> = ({
  inviteId,
  onExitPreview,
}) => {
  const [member, setMember] = useState<WorkspaceMemberItem | null>(null);
  const [group, setGroup] = useState<WorkspaceTeamGroup | null>(null);
  const [peers, setPeers] = useState<
    Array<{ id: string; fullName: string; designation: string; avatarUrl?: string }>
  >([]);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phoneCode, setPhoneCode] = useState<string>('+1');
  const [phone, setPhone] = useState<string>('');
  const [country, setCountry] = useState<string>('United States');
  const [stateName, setStateName] = useState<string>('California');
  const [city, setCity] = useState<string>('San Francisco');
  const [address, setAddress] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [editingAvatarTarget, setEditingAvatarTarget] = useState<ImageEditorTarget | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [confirmedMsg, setConfirmedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchPublicMemberInvite(inviteId)
      .then((data) => {
        setMember(data.member);
        setGroup(data.group);
        setPeers(data.teamPeers || []);
        setFirstName(data.member.firstName || '');
        setLastName(data.member.lastName || '');
        setBio(data.member.bio || '');
        setAvatarUrl(data.member.avatarUrl || '');
        const rawPhone = data.member.phone || '';
        const foundCode = COUNTRY_DIAL_CODES.find((c) => rawPhone.startsWith(c.code));
        if (foundCode) {
          setPhoneCode(foundCode.code);
          setPhone(rawPhone.slice(foundCode.code.length).trim());
        } else {
          setPhone(rawPhone);
        }
        const memberCountry = data.member.country || 'United States';
        setCountry(memberCountry);
        const states = Object.keys(COUNTRY_STATE_CITY_DIRECTORY[memberCountry] || {});
        const memberState = data.member.state || states[0] || '';
        setStateName(memberState);
        const cities = COUNTRY_STATE_CITY_DIRECTORY[memberCountry]?.[memberState] || [];
        setCity(data.member.city || cities[0] || '');
        setAddress(data.member.address || '');
      })
      .catch((err: any) => {
        setErrorMsg(err?.message || 'Unable to load member invitation.');
      })
      .finally(() => setIsLoading(false));
  }, [inviteId]);

  const handleConfirmProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;
    setIsConfirming(true);
    try {
      const fullPhone = phone.trim() ? `${phoneCode} ${phone.trim()}`.trim() : '';
      const res = await acceptPublicMemberInvite(inviteId, {
        firstName: firstName.trim() || member.firstName,
        lastName: lastName.trim(),
        phone: fullPhone,
        bio: bio.trim(),
        country,
        state: stateName,
        city,
        address: address.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      setMember(res.member);
      setConfirmedMsg('Your Workspace Member Profile is confirmed and Active! Status updated in real-time.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Confirmation failed.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-14 px-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0B57D0] text-white flex items-center justify-center font-bold text-sm">
            W
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight">Workspace Pro</span>
            <span className="ml-2 text-xs text-slate-400">· Official Member Invitation Portal</span>
          </div>
        </div>

        {onExitPreview && (
          <button
            type="button"
            onClick={onExitPreview}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workspace</span>
          </button>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        {isLoading ? (
          <div className="text-sm text-slate-500">Loading member profile...</div>
        ) : errorMsg || !member ? (
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3 shadow-lg">
            <div className="text-base font-bold text-red-600">Invitation Unavailable</div>
            <p className="text-xs text-slate-500">{errorMsg}</p>
            {onExitPreview && (
              <button
                type="button"
                onClick={onExitPreview}
                className="px-4 py-2 rounded-full bg-[#0B57D0] text-white text-xs font-semibold"
              >
                Return to Workspace
              </button>
            )}
          </div>
        ) : (
          <div className="max-w-2xl w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            {/* Banner */}
            <div
              className="h-28 px-6 flex items-end pb-4 relative"
              style={{
                background: `linear-gradient(135deg, ${group?.color || '#0B57D0'}, #1e293b)`,
              }}
            >
              <div className="flex items-center gap-2 text-white/90 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Team Member Profile · {member.teamName}</span>
              </div>
            </div>

            <div className="px-6 md:px-8 pb-8 -mt-10 relative space-y-6">
              {/* Avatar & Identity */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  {avatarUrl || member.avatarUrl ? (
                    <img
                      src={avatarUrl || member.avatarUrl}
                      alt={member.fullName}
                      className="w-20 h-20 rounded-2xl object-cover border-4 border-white dark:border-slate-900 shadow-md bg-white"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-2xl border-4 border-white dark:border-slate-900 shadow-md text-white font-bold text-2xl flex items-center justify-center"
                      style={{ backgroundColor: group?.color || '#0B57D0' }}
                    >
                      {member.firstName.charAt(0).toUpperCase()}
                      {member.lastName ? member.lastName.charAt(0).toUpperCase() : ''}
                    </div>
                  )}
                  <div className="pb-1">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {member.fullName}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      <span className="font-semibold text-[#0B57D0] dark:text-blue-400 flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        {member.designation}
                      </span>
                      <span>·</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800">
                        {member.teamName}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <input
                        ref={avatarFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setEditingAvatarTarget({
                                title: `${firstName || 'Profile'} Avatar`,
                                imageUrl: reader.result,
                                defaultAspect: '1:1',
                              });
                            }
                          };
                          reader.readAsDataURL(f);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        <Camera className="w-3 h-3" />
                        Upload Photo
                      </button>
                      {(avatarUrl || member.avatarUrl) && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingAvatarTarget({
                              title: `${firstName || 'Profile'} Avatar`,
                              imageUrl: avatarUrl || member.avatarUrl || '',
                              defaultAspect: '1:1',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Crop / Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-end ${
                    member.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{member.status === 'Active' ? 'Active Member' : 'Invited Member'}</span>
                </span>
              </div>

              {confirmedMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{confirmedMsg}</span>
                </div>
              )}

              {/* Member Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">First Name & Last Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {member.firstName} {member.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Official Email</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {member.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Designation / Role</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {member.designation}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Assigned Team Group</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {member.teamName}
                  </span>
                </div>
              </div>

              {/* Editable Profile Information Form */}
              <form onSubmit={handleConfirmProfile} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Complete & Confirm Your Member Profile
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Submitting activates your status and sends a notification to Admin
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Fazlul"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Talokder"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number (with Country Code)
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        {COUNTRY_DIAL_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.country}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 415-555-0199"
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Country
                    </label>
                    <select
                      value={country}
                      onChange={(e) => {
                        const newC = e.target.value;
                        setCountry(newC);
                        const states = Object.keys(COUNTRY_STATE_CITY_DIRECTORY[newC] || {});
                        const firstSt = states[0] || '';
                        setStateName(firstSt);
                        const cities = COUNTRY_STATE_CITY_DIRECTORY[newC]?.[firstSt] || [];
                        setCity(cities[0] || '');
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      {Object.keys(COUNTRY_STATE_CITY_DIRECTORY).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      State / Region / Division
                    </label>
                    <select
                      value={stateName}
                      onChange={(e) => {
                        const newSt = e.target.value;
                        setStateName(newSt);
                        const cities = COUNTRY_STATE_CITY_DIRECTORY[country]?.[newSt] || [];
                        setCity(cities[0] || '');
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      {Object.keys(COUNTRY_STATE_CITY_DIRECTORY[country] || {}).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      City
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      {(COUNTRY_STATE_CITY_DIRECTORY[country]?.[stateName] || []).map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Street Address / Office
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 500 Howard Street, Suite 400"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Profile Bio & Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe your role, core responsibilities, or contact notes..."
                    className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    Invitation ID: <code className="font-mono">{member.inviteToken}</code>
                  </span>
                  <button
                    type="submit"
                    disabled={isConfirming}
                    className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    {isConfirming
                      ? 'Activating Profile...'
                      : member.status === 'Active'
                      ? 'Save Profile Updates'
                      : 'Accept Invitation & Activate Profile'}
                  </button>
                </div>
              </form>

              {/* Team Peers */}
              {peers.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#0B57D0]" />
                    <span>Fellow Members in {member.teamName}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {peers.map((peer: { id: string; fullName: string; designation: string; avatarUrl?: string }) => (
                      <div
                        key={peer.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs"
                      >
                        <div className="w-6 h-6 rounded-full bg-[#0B57D0] text-white text-[10px] font-bold flex items-center justify-center">
                          {peer.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                            {peer.fullName}
                          </div>
                          <div className="text-[10px] text-slate-500">{peer.designation}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {editingAvatarTarget && (
        <Suspense fallback={null}>
          <ImageEditorModal
            isOpen={Boolean(editingAvatarTarget)}
            target={editingAvatarTarget}
            onClose={() => setEditingAvatarTarget(null)}
            onSaved={(res) => {
              setAvatarUrl(res.dataUrl);
              setEditingAvatarTarget(null);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

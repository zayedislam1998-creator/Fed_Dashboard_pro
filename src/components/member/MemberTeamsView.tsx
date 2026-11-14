import React, { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { EmptyAppCard, MemberBootstrapData } from './shared';

export function MemberTeamsView({
  data,
  searchQuery = '',
}: {
  data: MemberBootstrapData;
  searchQuery?: string;
}) {
  const [query, setQuery] = useState('');
  const combinedQuery = (query || searchQuery).trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!combinedQuery) return data.teams.members;
    return data.teams.members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(combinedQuery) ||
        m.email.toLowerCase().includes(combinedQuery) ||
        (m.designation || '').toLowerCase().includes(combinedQuery) ||
        (m.teamName || '').toLowerCase().includes(combinedQuery)
    );
  }, [data.teams.members, combinedQuery]);

  return (
    <div className="space-y-4">
      <div className="mp-card-soft rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
        <Search className="w-4 h-4 text-[var(--mp-text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a teammate, designation, or group..."
          className="w-full bg-transparent text-sm text-[var(--mp-text)] focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyAppCard
          icon={Users}
          title="No matching teammates"
          subtitle="Try clearing your search filter."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <div key={m.id} className="mp-card-soft rounded-3xl p-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[var(--mp-accent-soft)] text-[var(--mp-accent-text)] font-bold flex items-center justify-center shrink-0">
                {String(m.fullName || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--mp-text)] truncate">{m.fullName}</div>
                <div className="text-xs text-[var(--mp-text-muted)] truncate">{m.designation || 'Team Member'}</div>
                {m.teamName && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--mp-surface-subtle)] text-[var(--mp-text)]">
                    {m.teamName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

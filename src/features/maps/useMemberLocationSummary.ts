import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMemberLocationSummary } from '../../services/api/analyticsApi';
import type { MemberLocationSummary, StateUserItem } from './contracts';

export function useMemberLocationSummary() {
  const [summary, setSummary] = useState<MemberLocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMemberLocationSummary();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load member location summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived lookup map: stateCode -> count
  const stateCounts = useMemo<Record<string, number>>(() => {
    if (!summary?.states) return {};
    const map: Record<string, number> = {};
    for (const item of summary.states) {
      map[item.stateCode] = item.count;
    }
    return map;
  }, [summary]);

  // Derived lookup map: stateCode -> users array
  const stateUsers = useMemo<Record<string, StateUserItem[]>>(() => {
    if (!summary?.states) return {};
    const map: Record<string, StateUserItem[]> = {};
    for (const item of summary.states) {
      if (item.users && item.users.length > 0) {
        map[item.stateCode] = item.users;
      }
    }
    return map;
  }, [summary]);

  return {
    summary,
    stateCounts,
    stateUsers,
    loading,
    error,
    reload: loadData,
  };
}

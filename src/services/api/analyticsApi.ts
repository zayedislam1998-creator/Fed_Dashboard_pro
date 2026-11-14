import type { MemberLocationSummary } from '../../features/maps/contracts';

/**
 * Fetches the aggregated registered member distribution across US States
 * along with reconciled excluded location buckets.
 */
export async function fetchMemberLocationSummary(): Promise<MemberLocationSummary> {
  const res = await fetch('/api/analytics/member-location-summary', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch member location summary: ${res.statusText}`);
  }

  return res.json();
}

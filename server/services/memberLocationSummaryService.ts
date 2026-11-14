import { prisma } from '../db/prisma';

export interface StateCountItem {
  stateCode: string;
  count: number;
}

export interface MemberLocationExcludedBuckets {
  unspecifiedUSState: number;
  outsideUS: number;
  unspecifiedCountry: number;
  districtOfColumbia: number;
  territories: number;
}

export interface MemberLocationSummary {
  schemaVersion: 1;
  metric: 'ACTIVE_REGISTERED_MEMBERS';
  generatedAt: string;
  totalEligible: number;
  totalPlotted: number;
  states: StateCountItem[];
  excluded: MemberLocationExcludedBuckets;
}

// 50 US States canonical 2-letter postal codes allowlist
const VALID_50_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]);

const US_TERRITORIES = new Set(['PR', 'VI', 'GU', 'MP', 'AS']);

/**
 * Aggregates active registered workspace users into state distributions
 * and reconciles all excluded buckets with zero double-counting.
 */
export async function getMemberLocationSummary(): Promise<MemberLocationSummary> {
  const users = await prisma.workspaceUser.findMany({
    where: { isActive: true },
    select: {
      id: true,
      countryCode: true,
      stateCode: true,
      stateName: true,
    },
  });

  const stateTally = new Map<string, number>();
  for (const st of VALID_50_STATES) {
    stateTally.set(st, 0);
  }

  let unspecifiedUSState = 0;
  let outsideUS = 0;
  let unspecifiedCountry = 0;
  let districtOfColumbia = 0;
  let territories = 0;
  let totalPlotted = 0;

  for (const u of users) {
    const rawCountry = (u.countryCode || '').trim().toUpperCase();
    if (!rawCountry) {
      unspecifiedCountry++;
      continue;
    }

    if (rawCountry !== 'US') {
      outsideUS++;
      continue;
    }

    // Country is US: normalize state code
    const rawState = (u.stateCode || '').trim().toUpperCase();
    if (!rawState) {
      unspecifiedUSState++;
      continue;
    }

    if (rawState === 'DC') {
      districtOfColumbia++;
      continue;
    }

    if (US_TERRITORIES.has(rawState)) {
      territories++;
      continue;
    }

    if (VALID_50_STATES.has(rawState)) {
      stateTally.set(rawState, (stateTally.get(rawState) || 0) + 1);
      totalPlotted++;
    } else {
      unspecifiedUSState++;
    }
  }

  const states: StateCountItem[] = Array.from(stateTally.entries())
    .map(([stateCode, count]) => ({ stateCode, count }))
    .sort((a, b) => b.count - a.count || a.stateCode.localeCompare(b.stateCode));

  const totalEligible = users.length;

  return {
    schemaVersion: 1,
    metric: 'ACTIVE_REGISTERED_MEMBERS',
    generatedAt: new Date().toISOString(),
    totalEligible,
    totalPlotted,
    states,
    excluded: {
      unspecifiedUSState,
      outsideUS,
      unspecifiedCountry,
      districtOfColumbia,
      territories,
    },
  };
}

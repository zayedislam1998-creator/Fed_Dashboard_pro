import { prisma } from '../db/prisma';

export interface StateUserItem {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  city?: string | null;
}

export interface StateCountItem {
  stateCode: string;
  count: number;
  users?: StateUserItem[];
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

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA',
  COLORADO: 'CO', CONNECTICUT: 'CT', DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA',
  HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA',
  KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD',
  MASSACHUSETTS: 'MA', MICHIGAN: 'MI', MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO',
  MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH',
  OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT',
  VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV', WISCONSIN: 'WI', WYOMING: 'WY',
  'DISTRICT OF COLUMBIA': 'DC',
};

function resolveUSStateCode(stateCode?: string | null, stateName?: string | null): string | null {
  const code = (stateCode || '').trim().toUpperCase();
  if (VALID_50_STATES.has(code) || code === 'DC' || US_TERRITORIES.has(code)) {
    return code;
  }
  if (US_STATE_NAME_TO_CODE[code]) {
    return US_STATE_NAME_TO_CODE[code];
  }
  const name = (stateName || '').trim().toUpperCase();
  if (US_STATE_NAME_TO_CODE[name]) {
    return US_STATE_NAME_TO_CODE[name];
  }
  if (VALID_50_STATES.has(name) || name === 'DC' || US_TERRITORIES.has(name)) {
    return name;
  }
  return null;
}

function isUSCountry(countryCode?: string | null, countryName?: string | null, hasUSState = false): boolean {
  const code = (countryCode || '').trim().toUpperCase();
  if (code === 'US' || code === 'USA' || code === 'UNITED STATES') return true;
  const name = (countryName || '').trim().toUpperCase();
  if (name === 'US' || name === 'USA' || name === 'UNITED STATES' || name === 'UNITED STATES OF AMERICA') return true;
  if (!code && !name && hasUSState) return true;
  return false;
}

/**
 * Aggregates active registered workspace users into state distributions
 * and reconciles all excluded buckets with zero double-counting.
 */
export async function getMemberLocationSummary(): Promise<MemberLocationSummary> {
  const users = await prisma.workspaceUser.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      countryCode: true,
      countryName: true,
      stateCode: true,
      stateName: true,
      cityName: true,
    },
  });

  const stateTally = new Map<string, number>();
  const stateUsers = new Map<string, StateUserItem[]>();
  for (const st of VALID_50_STATES) {
    stateTally.set(st, 0);
    stateUsers.set(st, []);
  }

  let unspecifiedUSState = 0;
  let outsideUS = 0;
  let unspecifiedCountry = 0;
  let districtOfColumbia = 0;
  let territories = 0;
  let totalPlotted = 0;

  for (const u of users) {
    const resolvedState = resolveUSStateCode(u.stateCode, u.stateName);
    const countryIsUS = isUSCountry(u.countryCode, u.countryName, Boolean(resolvedState));

    if (!countryIsUS) {
      const rawCountry = (u.countryCode || u.countryName || '').trim();
      if (!rawCountry) {
        unspecifiedCountry++;
      } else {
        outsideUS++;
      }
      continue;
    }

    if (!resolvedState) {
      unspecifiedUSState++;
      continue;
    }

    if (resolvedState === 'DC') {
      districtOfColumbia++;
      continue;
    }

    if (US_TERRITORIES.has(resolvedState)) {
      territories++;
      continue;
    }

    if (VALID_50_STATES.has(resolvedState)) {
      stateTally.set(resolvedState, (stateTally.get(resolvedState) || 0) + 1);
      const list = stateUsers.get(resolvedState) || [];
      list.push({
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role || 'MEMBER',
        city: u.cityName || null,
      });
      stateUsers.set(resolvedState, list);
      totalPlotted++;
    } else {
      unspecifiedUSState++;
    }
  }

  const states: StateCountItem[] = Array.from(stateTally.entries())
    .map(([stateCode, count]) => ({
      stateCode,
      count,
      users: stateUsers.get(stateCode) || [],
    }))
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

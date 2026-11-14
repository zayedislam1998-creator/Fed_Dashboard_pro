// Types and contracts for Lightweight US State Map & Member Distribution

export interface StateUserItem {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  city?: string | null;
}

export interface StateCountItem {
  stateCode: string; // 2-letter uppercase ISO / postal code, e.g. "CA", "NY"
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

export type USMapDisplayMode = 'distribution' | 'profile' | 'preview';

export interface USStateMapProps {
  mode?: USMapDisplayMode;
  /**
   * For distribution mode: map of stateCode -> count
   */
  stateCounts?: Record<string, number>;
  /**
   * Map of stateCode -> users array
   */
  stateUsers?: Record<string, StateUserItem[]>;
  /**
   * Currently active or selected stateCode
   */
  selectedStateCode?: string | null;
  /**
   * Callback when a user clicks or selects a state
   */
  onSelectState?: (stateCode: string) => void;
  /**
   * Custom accent color (defaults to "#0B57D0")
   */
  accentColor?: string;
  /**
   * Optional custom class for the svg container
   */
  className?: string;
  /**
   * Whether to show state postal abbreviations on land
   */
  showLabels?: boolean;
}

export interface StateMarkerProps {
  stateCode: string;
  stateName: string;
  count: number;
  x: number;
  y: number;
  users?: StateUserItem[];
  isSelected?: boolean;
  onClick?: () => void;
  accentColor?: string;
}

export interface StateDistributionCardProps {
  className?: string;
  title?: string;
  subtitle?: string;
  onFilterByState?: (stateCode: string) => void;
}

export interface ProfileLocationMapProps {
  stateCode?: string | null;
  stateName?: string | null;
  countryName?: string | null;
  cityName?: string | null;
  className?: string;
}

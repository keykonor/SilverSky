// Mirrors schemas/core.v0.1.schema.json. Optional interpretation fields remain
// optional because the v0.1 HTTP contract keeps its Sprint 1 response valid.
export type DataStatus = 'VERIFIED' | 'PUBLIC_DATA' | 'SIMULATED_DATA' | 'DATA_UNAVAILABLE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type ReviewOutcome = 'PASS' | 'DOWNGRADE' | 'REJECT' | 'UNKNOWN';

export interface LocationRef {
  label: string;
  coordinate?: { longitude: number; latitude: number };
  canonical_poi_id?: string;
  entity_precision?: 'POI' | 'ENTRANCE' | 'PICKUP_POINT' | 'AREA' | 'UNKNOWN';
  entrance_verified?: boolean;
}

export interface DepartureWindow {
  start: string;
  end: string;
  precision: 'AFTERNOON';
}

export interface ElderlyProfile {
  age?: number | null;
  mobility: 'NORMAL' | 'MODERATE' | 'LIMITED' | 'ASSISTED' | 'WHEELCHAIR' | 'UNKNOWN' | 'INDEPENDENT';
  walking_tolerance_m?: number | null;
  wheelchair_requirement: boolean | null;
  assistance_requirement: boolean | null;
  preferences?: string[];
}

export interface TripPreferences {
  focus: 'SAFETY_COMFORT' | 'TIME' | 'LESS_WALKING' | 'FEWER_TRANSFERS' | 'LOW_COST' | 'BALANCED' | 'FASTEST' | 'ECONOMICAL';
  air_option: 'ALLOW_SIMULATION' | 'GROUND_ONLY' | 'UNSPECIFIED';
  max_cost_cny?: number | null;
  max_transfers?: number | null;
}

export type Urgency = 'NORMAL' | 'TIME_SENSITIVE' | 'URGENT_TRAVEL' | 'MEDICAL_EMERGENCY' | 'UNKNOWN' | 'URGENT';
export type Clarification = 'urgency' | 'elderly_profile.mobility' | 'elderly_profile.assistance_requirement' | 'preferences.focus';
export type UncertainField = Clarification | 'origin' | 'destination' | 'departure_time' | 'city' | 'location_role';
export type MissingField = 'origin' | 'destination' | 'departure_time';

export interface PlanningState {
  origin?: LocationRef;
  destination?: LocationRef;
  location_candidate?: LocationRef;
  departure_time?: string;
  departure_window?: DepartureWindow;
  city?: 'TIANJIN' | 'SHENZHEN';
  urgency?: Exclude<Urgency, 'URGENT'>;
  elderly_profile?: ElderlyProfile;
  preferences?: TripPreferences;
  pending_clarifications?: Clarification[];
}

export interface UserRequest {
  origin: LocationRef;
  destination: LocationRef;
  departure_time: string | null;
  departure_window?: DepartureWindow;
  city?: 'TIANJIN' | 'SHENZHEN';
  urgency: Urgency;
  elderly_profile: ElderlyProfile;
  preferences: TripPreferences;
}

export interface TextInterpretRequest {
  text: string;
  reference_time: string;
  planning_state?: PlanningState;
}

export interface InterpretationResult {
  user_request: UserRequest | null;
  needs_summary: string;
  missing_fields: MissingField[];
  assumptions: string[];
  interpretation_summary?: string;
  structured_intent?: PlanningState;
  planning_state?: PlanningState;
  uncertain_fields?: UncertainField[];
  follow_up_question?: string | null;
  planning_allowed?: boolean;
}

export interface SourceEvidence {
  data_status: DataStatus;
  source_ref?: string;
  observed_at?: string;
  unavailable_reason?: string;
}

interface SegmentBase {
  segment_type: 'WALK' | 'CAR' | 'SHUTTLE' | 'AIR' | 'WAIT';
  origin: LocationRef;
  destination: LocationRef;
  distance_m: number | null;
  duration_min: number | null;
  evidence: SourceEvidence;
}

type SegmentGeometry =
  | { geometry?: never; geometry_status?: never; geometry_evidence?: never }
  | {
      geometry: { type: 'LineString'; coordinates: [number, number][] };
      geometry_status: 'PUBLIC_ROUTE_SNAPSHOT';
      geometry_evidence: SourceEvidence & { data_status: 'PUBLIC_DATA' };
    }
  | {
      geometry: { type: 'LineString'; coordinates: [number, number][] };
      geometry_status: 'STRAIGHT_REFERENCE_LINE' | 'SIMULATED_AIR_CORRIDOR';
      geometry_evidence: SourceEvidence & { data_status: 'SIMULATED_DATA' };
    };

export type Segment = SegmentBase & SegmentGeometry;

export interface RiskAssessment {
  weather: RiskLevel;
  mobility: RiskLevel;
  transfer: RiskLevel;
  operational: RiskLevel;
  data_uncertainty: RiskLevel;
  review_outcome: ReviewOutcome;
  reasons: string[];
}

export interface RouteOption {
  route_id: string;
  route_type: 'GROUND_ONLY' | 'GROUND_AIR_GROUND';
  display_labels: Array<'RECOMMENDED' | 'SAFETY_COMFORT' | 'FASTEST' | 'ECONOMICAL' | 'SIMULATED_SCENARIO' | 'UNRANKED'>;
  total_time_min: number | null;
  walking_distance_m: number | null;
  transfer_count: number | null;
  estimated_cost_cny: number | null;
  risk_level: RiskLevel;
  comfort_score: number | null;
  data_status: DataStatus;
  segments: Segment[];
  risk_assessment: RiskAssessment;
  explanation: string;
}

export interface PlanningResult {
  schema_version: '0.1-proposal';
  user_request: UserRequest;
  needs_summary: string;
  route_options: RouteOption[];
  warnings: string[];
}

// Online ground reference stays outside the safety-reviewed PlanningResult contract.
export interface RealityPlace {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly location: [number, number]; // GCJ-02
  readonly precision: 'POI';
  readonly source: string;
}

export interface RealityPlaceDetail extends RealityPlace {
  readonly retrieved_at: string;
  readonly coordinate_system: 'GCJ-02';
  readonly arrival_point: [number, number] | null;
  readonly entrance_verified: false;
  readonly pickup_verified: false;
  readonly accessibility: 'UNKNOWN';
}

export interface DirectGroundReference {
  status: 'OK';
  readonly origin: RealityPlaceDetail;
  readonly destination: RealityPlaceDetail;
  driving: { distance_m: number; duration_min: number; geometry: [number, number][]; steps?: Array<{ instruction: string; road: string }>; retrieved_at: string };
  walking: { distance_m: number; duration_min: number } | null;
  coordinate_system: 'GCJ-02';
  safety_review: 'NOT_PERFORMED';
  source: string;
  retrieved_at: string;
  entrance: 'UNKNOWN';
  pickup: 'UNKNOWN';
  accessibility: 'UNKNOWN';
}

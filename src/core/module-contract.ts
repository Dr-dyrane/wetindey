export interface Clarification {
  id: string;
  question: string;
  options: string[];
}

export interface DiscoveryInput<TItem> {
  item: TItem;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface Candidate<TDetail> {
  id: string;
  placeId: string;
  detail: TDetail;
}

export interface RankingContext {
  lat?: number;
  lng?: number;
  sortBy?: "distance" | "price" | "confidence";
}

export interface FreshnessPolicy {
  expirationHours: number;
  staleHours: number;
}

export interface TrustAssessment {
  confidenceScore: number;
  confidenceLevel: "confirmed" | "caution" | "unavailable";
  explanation: string;
}

export interface DecisionSummary {
  title: string;
  priceFormatted: string;
  unitFormatted: string;
  trustFormatted: string;
  locationFormatted: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface WetinDeyModule<TItem, TObservation, TDetail> {
  id: string;
  displayName: string;
  version: string;

  search: {
    resolve(query: string, locale: string): Promise<TItem[]>;
    getClarifications(item: TItem): Clarification[];
  };

  discovery: {
    getCandidates(input: DiscoveryInput<TItem>): Promise<Candidate<TDetail>[]>;
    rank(candidates: Candidate<TDetail>[], context: RankingContext): Candidate<TDetail>[];
  };

  reporting: {
    schema: unknown;
    normalize(input: unknown): TObservation;
    validate(input: TObservation): ValidationResult;
  };

  trust: {
    freshnessPolicy: FreshnessPolicy;
    assess(observations: TObservation[]): TrustAssessment;
  };

  presentation: {
    formatSummary(detail: TDetail, locale: string): DecisionSummary;
  };
}

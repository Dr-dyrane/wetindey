import {
  WetinDeyModule,
  Clarification,
  DiscoveryInput,
  Candidate,
  RankingContext,
  FreshnessPolicy,
  TrustAssessment,
  DecisionSummary,
  ValidationResult
} from "@/core/module-contract";
import { FoodItem, FoodObservation, FoodDetail } from "../domain/types";

// Static mock database for Food module encapsulation
const FOOD_DATABASE_ITEMS: FoodItem[] = [
  { id: "1", name: "Rice (50kg bag)", aliases: ["rice", "bag of rice", "local rice", "foreign rice"], category: "staple" },
  { id: "2", name: "Oloyin Beans (1kg)", aliases: ["beans", "oloyin", "brown beans", "ewa"], category: "staple" },
  { id: "3", name: "White Garri (1 Paint)", aliases: ["garri", "white garri", "gari", "leki"], category: "staple" },
  { id: "4", name: "Yam (1 Tuber)", aliases: ["yam", "tuber of yam", "isu"], category: "staple" },
  { id: "5", name: "Palm Oil (1L)", aliases: ["oil", "palm oil", "red oil", "epo"], category: "oil" },
];

const FOOD_DATABASE_OBSERVATIONS: FoodObservation[] = [
  {
    id: "obs_1",
    itemId: "1",
    placeId: "p1", // Tejuosho Market
    priceMin: 85000,
    unit: "50kg bag",
    priceType: "Exact",
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago
    sourceType: "Contributor",
    confidence: 96,
  },
  {
    id: "obs_2",
    itemId: "1",
    placeId: "p2", // Oyinbo Market
    priceMin: 82000,
    priceMax: 86000,
    unit: "50kg bag",
    priceType: "Range",
    timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // Yesterday
    sourceType: "Public data",
    confidence: 74,
  },
  {
    id: "obs_3",
    itemId: "1",
    placeId: "p3", // Yaba Kiosk
    priceMin: 88000,
    unit: "50kg bag",
    priceType: "Exact",
    timestamp: new Date(Date.now() - 72 * 3600 * 1000).toISOString(), // 3 days ago
    sourceType: "Vendor",
    confidence: 45,
  },
  {
    id: "obs_4",
    itemId: "2",
    placeId: "p1", // Tejuosho Market
    priceMin: 2400,
    unit: "1kg",
    priceType: "Exact",
    timestamp: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // 1 hour ago
    sourceType: "Contributor",
    confidence: 98,
  },
  {
    id: "obs_5",
    itemId: "2",
    placeId: "p4", // Sabo Market
    priceMin: 2300,
    priceMax: 2600,
    unit: "1kg",
    priceType: "Range",
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5 hours ago
    sourceType: "Vendor",
    confidence: 92,
  },
  {
    id: "obs_6",
    itemId: "3",
    placeId: "p3", // Yaba Kiosk
    priceMin: 3200,
    unit: "Paint bucket",
    priceType: "Exact",
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4 hours ago
    sourceType: "Contributor",
    confidence: 94,
  },
  {
    id: "obs_7",
    itemId: "3",
    placeId: "p2", // Oyinbo Market
    priceMin: 2900,
    priceMax: 3300,
    unit: "Paint bucket",
    priceType: "Range",
    timestamp: new Date(Date.now() - 26 * 3600 * 1000).toISOString(), // Yesterday
    sourceType: "Vendor",
    confidence: 82,
  },
];

export class FoodModule implements WetinDeyModule<FoodItem, FoodObservation, FoodDetail> {
  public readonly id = "food";
  public readonly displayName = "Food price and availability";
  public readonly version = "1.0.0";

  public readonly search = {
    resolve: async (query: string, _locale: string): Promise<FoodItem[]> => {
      const lowerQuery = query.toLowerCase().trim();
      if (!lowerQuery) return [];

      return FOOD_DATABASE_ITEMS.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerQuery) ||
          item.aliases.some((alias) => alias.includes(lowerQuery))
      );
    },

    getClarifications: (item: FoodItem): Clarification[] => {
      // Return specific local unit/variant clarification choices where needed
      if (item.id === "1") {
        return [
          {
            id: "rice_origin",
            question: "Which type of rice you dey search?",
            options: ["Local Parboiled Rice", "Foreign Imported Rice"],
          },
        ];
      }
      return [];
    },
  };

  public readonly trust = {
    freshnessPolicy: {
      expirationHours: 72,
      staleHours: 24,
    } as FreshnessPolicy,

    assess: (observations: FoodObservation[]): TrustAssessment => {
      if (observations.length === 0) {
        return {
          confidenceScore: 0,
          confidenceLevel: "unavailable",
          explanation: "No observations reported recently.",
        };
      }

      // Latest observation determines initial status
      const latest = observations.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      const ageHours = (Date.now() - new Date(latest.timestamp).getTime()) / (3600 * 1000);

      let confidenceLevel: "confirmed" | "caution" | "unavailable" = "confirmed";
      if (ageHours > this.trust.freshnessPolicy.expirationHours) {
        confidenceLevel = "unavailable";
      } else if (ageHours > this.trust.freshnessPolicy.staleHours) {
        confidenceLevel = "caution";
      }

      // Base confidence matches source confidence weight adjusted for age decay
      const decayFactor = Math.max(0.5, 1 - ageHours / (this.trust.freshnessPolicy.expirationHours * 2));
      const confidenceScore = Math.round(latest.confidence * decayFactor);

      return {
        confidenceScore,
        confidenceLevel: confidenceScore < 50 ? "unavailable" : confidenceLevel,
        explanation: `Last checked ${Math.round(ageHours)}h ago via ${latest.sourceType}.`,
      };
    },
  };

  public readonly discovery = {
    getCandidates: async (input: DiscoveryInput<FoodItem>): Promise<Candidate<FoodDetail>[]> => {
      const { item } = input;

      // Filter observations matching the item
      const observations = FOOD_DATABASE_OBSERVATIONS.filter((obs) => obs.itemId === item.id);

      // Group by place to create derived candidate offers
      const placeGroups: Record<string, FoodObservation[]> = {};
      observations.forEach((obs) => {
        if (!placeGroups[obs.placeId]) {
          placeGroups[obs.placeId] = [];
        }
        placeGroups[obs.placeId].push(obs);
      });

      const candidates: Candidate<FoodDetail>[] = [];

      Object.entries(placeGroups).forEach(([placeId, obsList]) => {
        // Run trust assessment
        const assessment = this.trust.assess(obsList);
        const primaryObs = obsList[0];

        // Format price representation
        const priceText =
          primaryObs.priceType === "Exact"
            ? `₦${primaryObs.priceMin.toLocaleString()}`
            : `₦${primaryObs.priceMin.toLocaleString()} - ₦${(primaryObs.priceMax ?? primaryObs.priceMin).toLocaleString()}`;

        const detail: FoodDetail = {
          id: `offer_${item.id}_${placeId}`,
          item,
          price: priceText,
          unit: primaryObs.unit,
          priceType: primaryObs.priceType,
          freshnessText: assessment.explanation,
          confidenceLevel: assessment.confidenceLevel,
          confidenceScore: assessment.confidenceScore,
          sourceType: primaryObs.sourceType,
        };

        candidates.push({
          id: detail.id,
          placeId,
          detail,
        });
      });

      return candidates;
    },

    rank: (candidates: Candidate<FoodDetail>[], context: RankingContext): Candidate<FoodDetail>[] => {
      // Sort logic based on sorting preferences
      const sorted = [...candidates];
      if (context.sortBy === "price") {
        sorted.sort((a, b) => {
          const priceA = parseFloat(a.detail.price.replace(/[^\d]/g, ""));
          const priceB = parseFloat(b.detail.price.replace(/[^\d]/g, ""));
          return priceA - priceB;
        });
      } else if (context.sortBy === "confidence") {
        sorted.sort((a, b) => b.detail.confidenceScore - a.detail.confidenceScore);
      }
      return sorted;
    },
  };

  public readonly reporting = {
    schema: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        placeId: { type: "string" },
        priceMin: { type: "number" },
        priceMax: { type: "number" },
        unit: { type: "string" },
        priceType: { type: "string", enum: ["Exact", "Range"] },
      },
      required: ["itemId", "placeId", "priceMin", "unit", "priceType"],
    },

    normalize: (input: unknown): FoodObservation => {
      const data = input as {
        itemId: string;
        placeId: string;
        priceMin: number | string;
        priceMax?: number | string;
        unit: string;
        priceType: "Exact" | "Range";
      };
      return {
        id: `obs_report_${Date.now()}`,
        itemId: data.itemId,
        placeId: data.placeId,
        priceMin: Number(data.priceMin),
        priceMax: data.priceMax ? Number(data.priceMax) : undefined,
        unit: data.unit,
        priceType: data.priceType,
        timestamp: new Date().toISOString(),
        sourceType: "Contributor",
        confidence: 90, // Newly reported starts with base contributor confidence
      };
    },

    validate: (input: FoodObservation): ValidationResult => {
      const errors: string[] = [];
      if (!input.itemId) errors.push("Item is required.");
      if (!input.placeId) errors.push("Place location is required.");
      if (!input.priceMin || input.priceMin <= 0) errors.push("Valid price is required.");
      if (!input.unit) errors.push("Unit of measure is required.");

      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  };

  public readonly presentation = {
    formatSummary: (detail: FoodDetail, _locale: string): DecisionSummary => {
      return {
        title: `${detail.item.name} at Yaba`,
        priceFormatted: detail.price,
        unitFormatted: `per ${detail.unit}`,
        trustFormatted: `${detail.confidenceScore}% confidence (${detail.confidenceLevel})`,
        locationFormatted: `Place: ${detail.sourceType}`,
      };
    },
  };
}

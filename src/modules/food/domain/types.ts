export interface FoodItem {
  id: string;
  name: string;
  aliases: string[];
  category: "staple" | "protein" | "vegetable" | "oil" | "other";
}

export interface FoodObservation {
  id: string;
  itemId: string;
  placeId: string;
  priceMin: number;
  priceMax?: number;
  unit: string;
  priceType: "Exact" | "Range";
  timestamp: string; // ISO string
  sourceType: "Contributor" | "Public data" | "Vendor";
  confidence: number;
}

export interface FoodDetail {
  id: string;
  item: FoodItem;
  price: string;
  unit: string;
  priceType: "Exact" | "Range";
  freshnessText: string;
  confidenceLevel: "confirmed" | "caution" | "unavailable";
  confidenceScore: number;
  sourceType: "Contributor" | "Public data" | "Vendor";
}

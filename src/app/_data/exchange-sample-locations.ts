export type ExchangeLocationKind = "bank" | "bdc";

export interface ExchangeSampleLocation {
  id: string;
  name: string;
  kind: ExchangeLocationKind;
  areaName: string;
  description: string;
  lat: number;
  lng: number;
  provenance: "sample";
}

/**
 * Interaction-only demonstration points.
 *
 * These are not businesses, verified branches, licensed BDCs, or navigation
 * destinations. Generic names and `provenance: "sample"` are both required so
 * no caller can accidentally present them as current public place data.
 */
export const EXCHANGE_SAMPLE_LOCATIONS: readonly ExchangeSampleLocation[] = [
  {
    id: "sample-bank-festac",
    name: "Sample bank — Festac",
    kind: "bank",
    areaName: "Festac",
    description: "Demonstration point near Festac Town",
    lat: 6.4683,
    lng: 3.2841,
    provenance: "sample",
  },
  {
    id: "sample-bdc-mile-2",
    name: "Sample BDC — Mile 2",
    kind: "bdc",
    areaName: "Mile 2",
    description: "Demonstration point near Mile 2",
    lat: 6.4618,
    lng: 3.3157,
    provenance: "sample",
  },
  {
    id: "sample-bank-satellite",
    name: "Sample bank — Satellite Town",
    kind: "bank",
    areaName: "Satellite Town",
    description: "Demonstration point near Satellite Town",
    lat: 6.4476,
    lng: 3.2536,
    provenance: "sample",
  },
  {
    id: "sample-bdc-trade-fair",
    name: "Sample BDC — Trade Fair",
    kind: "bdc",
    areaName: "Trade Fair",
    description: "Demonstration point near the Trade Fair area",
    lat: 6.4694,
    lng: 3.2018,
    provenance: "sample",
  },
  {
    id: "sample-bank-ojo",
    name: "Sample bank — Ojo",
    kind: "bank",
    areaName: "Ojo",
    description: "Demonstration point near Ojo",
    lat: 6.4637,
    lng: 3.1819,
    provenance: "sample",
  },
  {
    id: "sample-bdc-iba",
    name: "Sample BDC — Iba",
    kind: "bdc",
    areaName: "Iba",
    description: "Demonstration point near Iba",
    lat: 6.5018,
    lng: 3.1987,
    provenance: "sample",
  },
];

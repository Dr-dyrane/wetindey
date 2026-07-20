import type { ExchangeLocation } from "@/integrations/maps/MapboxNearbyExchangeSearch";

/**
 * Explicit demonstration fallback for a browsing context where Mapbox returns
 * no usable exchange POIs. These are not businesses, licences, opening-state
 * claims, navigation destinations, or evidence that any outlet offers a rate.
 */
export const EXCHANGE_SAMPLE_LOCATIONS: readonly ExchangeLocation[] = [
  {
    id: "sample-bank-festac",
    providerId: "sample-bank-festac",
    name: "Festac Banking Hall",
    kind: "bank",
    description: "Festac Town",
    lat: 6.4683,
    lng: 3.2841,
    provenance: "sample",
    verification: "sample",
  },
  {
    id: "sample-bdc-mile-2",
    providerId: "sample-bdc-mile-2",
    name: "Mile 2 Exchange Desk",
    kind: "bdc",
    description: "Mile 2",
    lat: 6.4618,
    lng: 3.3157,
    provenance: "sample",
    verification: "sample",
  },
  {
    id: "sample-bank-satellite",
    providerId: "sample-bank-satellite",
    name: "Satellite Town Bank",
    kind: "bank",
    description: "Satellite Town",
    lat: 6.4476,
    lng: 3.2536,
    provenance: "sample",
    verification: "sample",
  },
  {
    id: "sample-bdc-trade-fair",
    providerId: "sample-bdc-trade-fair",
    name: "Trade Fair Exchange",
    kind: "bdc",
    description: "Trade Fair",
    lat: 6.4694,
    lng: 3.2018,
    provenance: "sample",
    verification: "sample",
  },
  {
    id: "sample-bank-ojo",
    providerId: "sample-bank-ojo",
    name: "Ojo Banking Hall",
    kind: "bank",
    description: "Ojo",
    lat: 6.4637,
    lng: 3.1819,
    provenance: "sample",
    verification: "sample",
  },
  {
    id: "sample-bdc-iba",
    providerId: "sample-bdc-iba",
    name: "Iba Exchange Desk",
    kind: "bdc",
    description: "Iba",
    lat: 6.5018,
    lng: 3.1987,
    provenance: "sample",
    verification: "sample",
  },
];

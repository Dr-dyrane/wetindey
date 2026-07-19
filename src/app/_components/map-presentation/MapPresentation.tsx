import React from "react";
import { MapPresentationView } from "./MapPresentationView";
import { MapPresentationProps } from "./imports";

export interface MapPresentationControllerProps extends MapPresentationProps {
  insetProbeRef: React.RefObject<HTMLDivElement | null>;
}

export function MapPresentation(props: MapPresentationControllerProps) {
  return <MapPresentationView {...props} />;
}

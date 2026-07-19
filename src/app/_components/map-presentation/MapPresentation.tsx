import React from "react";
import { MapPresentationView } from "./views/MapPresentationView";
import { MapPresentationProps } from "./imports/imports";

export interface MapPresentationControllerProps extends MapPresentationProps {
  insetProbeRef: React.RefObject<HTMLDivElement | null>;
}

export function MapPresentation(props: MapPresentationControllerProps) {
  return <MapPresentationView {...props} />;
}

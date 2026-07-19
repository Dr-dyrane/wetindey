import React, { useEffect, useRef } from "react";
import {
  MapPresentationProps,
  MapboxCanvas,
  MapRecenterControl,
  AlertTriangle,
  MapPin,
  Sun,
  Moon,
  X,
  MapCameraHandle
} from "./imports";
import { copy } from "./copy";
import "./MapPresentation.css";

function MapNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  return (
    <div
      role="alert"
      className="pointer-events-auto flex items-start gap-2 squircle bg-status-caution-bg px-3 py-2
                 shadow-raised animate-fade-in"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-caution-fg" />
      <span className="text-footnote text-status-caution-fg">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={copy.accessibility.dismiss}
        className="-my-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center squircle-full
                   text-status-caution-fg active:opacity-60 transition-opacity duration-instant"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface MapPresentationViewProps extends MapPresentationProps {
  insetProbeRef: React.RefObject<HTMLDivElement | null>;
}

export function MapPresentationView({
  mapMarkers,
  selectedPlaceId,
  onMarkerClick,
  cameraCenter,
  selfIdentity,
  route,
  activeDetent,
  leadingInset,
  isRegular,
  locationLabel,
  theme,
  toggleTheme,
  openLocationSurface,
  handleRecenter,
  locateError,
  setLocateError,
  dismissLocateError,
  onRetryCapabilityChange,
  insetProbeRef
}: MapPresentationViewProps) {
  const mapCameraRef = useRef<MapCameraHandle>(null);

  return (
    <div className="map-presentation-container">
      {/* Resolves `--shell-leading-inset` to px. Zero-height and inert; it exists
          only to be measured. Must stay inside the shell's subtree, which is
          where the variable is set. */}
      <div
        ref={insetProbeRef}
        aria-hidden
        className="map-presentation-probe"
      />

      <MapboxCanvas
        ref={mapCameraRef}
        candidates={mapMarkers}
        selectedPlaceId={selectedPlaceId}
        onMarkerClick={onMarkerClick}
        center={cameraCenter}
        selfIdentity={selfIdentity}
        route={route}
        /* At regular width the shell mounts no bottom sheet, so there is nothing
           below to compensate for, but the panel covers the leading edge, and
           without that padding a pin can be flown to and land behind it. */
        detent={isRegular ? null : activeDetent}
        padding={isRegular ? { left: leadingInset } : undefined}
        sharedUsers={[]}
        onRetryCapabilityChange={onRetryCapabilityChange}
      />

      {/* Floating controls. These sit directly on the map, so they use the
          translucent material rather than a solid surface, the map needs to
          stay legible through them. */}
      {/* `left` clears the shell's panel rather than sitting at a flat left-4.
          This chrome lives in the z-0 map layer, so at every regular width the
          panel was simply drawn on top of the location pill. Pure CSS, so it
          tracks the panel's clamp with no measurement and no resize listener. */}
      <div className="map-floating-controls">
        <div className="flex items-start justify-between gap-2">
          {/* A control, not a label, hence `pointer-events-auto` against the
              stack's `pointer-events-none`, and the tap floors. `min-w-tap` is
              load-bearing now the label stands alone: the shortest area name in
              the db is "Ojo", which would otherwise collapse the width under
              44pt. The caveat for a manually picked area survives on the selected
              row in LocationSheet, at the point where it is actionable. */}
          <button
            type="button"
            onClick={openLocationSurface}
            aria-label={copy.accessibility.changeLocation(locationLabel)}
            className="pointer-events-auto flex h-11 min-w-tap items-center justify-center gap-1.5 squircle-full
                       material-thick px-2.5 shadow-raised active:opacity-60 transition-opacity duration-instant"
          >
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" strokeWidth={2.25} />
            <span className="text-footnote font-medium text-text-primary">
              {locationLabel}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? copy.accessibility.switchLightMode : copy.accessibility.switchDarkMode}
            className="pointer-events-auto grid h-9 w-9 shrink-0 place-items-center squircle-full
                       material-thick shadow-raised text-text-primary
                       active:scale-90 transition-transform duration-instant"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>

        {locateError && <MapNotice message={locateError} onDismiss={dismissLocateError} />}
      </div>

      {/* Recenter. The shell publishes the live active detent inset; safe-area
          padding is additive so this remains reachable on gesture-navigation
          devices at every compact detent and on regular layouts. */}
      <div className="map-recenter-container">
        <MapRecenterControl
          /* Recenter refreshes physical evidence and moves presentation state.
             It never mutates the persisted browsing/search context. */
          onLocate={handleRecenter}
          onError={setLocateError}
        />
      </div>
    </div>
  );
}

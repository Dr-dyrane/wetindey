import {
  useCallback,
  useEffect,
  useRef,
  useState,
  getAreaTree,
  getCoverageForPoint,
  acquireDeviceLocation,
  useFreshDeviceLocation,
  useLocationStore,
  type AreaSummary,
  type AreaTree,
} from "../imports/imports";
import { useStrings } from "@/core/i18n";

export type LocateState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "problem"; title: string; body: string; canRetry: boolean }
  | {
      kind: "outside";
      distanceKm: number | null;
      nearest: AreaSummary | null;
    };

export interface UseLocationSheetOptions {
  open: boolean;
  onClose: () => void;
  radiusKm: number;
  onCommit?: (coords: { lat: number; lng: number }) => void;
}

export function useLocationSheet({
  open,
  onClose,
  radiusKm,
  onCommit,
}: UseLocationSheetOptions) {
  const browsingLocation = useLocationStore((s) => s.browsingLocation);
  const setManualBrowsingLocation = useLocationStore(
    (s) => s.setManualBrowsingLocation
  );
  const setDeviceBrowsingLocation = useLocationStore(
    (s) => s.setDeviceBrowsingLocation
  );
  const recordDeviceLocation = useLocationStore((s) => s.recordDeviceLocation);

  // The flattened dictionary, not useT(): acquireDeviceLocation returns i18n
  // KEYS at runtime, and the dictionary is the lookup for keys that are not
  // literals. Translation happens at set time, the same trade as useHomePage.
  const t = useStrings();

  const [tree, setTree] = useState<AreaTree | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [locate, setLocate] = useState<LocateState>({ kind: "idle" });
  const freshDeviceLocation = useFreshDeviceLocation();
  const [lgaSlug, setLgaSlug] = useState<string | null>(null);

  const generation = useRef(0);

  const loadTree = useCallback(async () => {
    const g = ++generation.current;
    setTreeError(null);
    try {
      const rows = await getAreaTree();
      if (g !== generation.current) return;
      setTree(rows);
    } catch (err) {
      console.error("LocationSheet: failed to load the area tree", err);
      if (g !== generation.current) return;
      setTree(null);
      setTreeError(t["location.load_error"]);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    void loadTree();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      setLocate({ kind: "idle" });
      setLgaSlug(null);
    };
  }, [open, loadTree]);

  const commit = useCallback(
    (coords: { lat: number; lng: number }) => {
      onCommit?.(coords);
      onClose();
    },
    [onCommit, onClose]
  );

  const handlePickArea = useCallback(
    (area: AreaSummary) => {
      setManualBrowsingLocation({
        lat: area.lat,
        lng: area.lng,
        areaName: area.name,
        areaSlug: area.slug,
      });
      commit({ lat: area.lat, lng: area.lng });
    },
    [setManualBrowsingLocation, commit]
  );

  const handleUseMyLocation = useCallback(() => {
    const g = ++generation.current;
    setLocate({ kind: "locating" });
    void acquireDeviceLocation({
      enableHighAccuracy: false,
      timeoutMs: 10_000,
      maximumAgeMs: 60_000,
    }).then(async (result) => {
      if (g !== generation.current) return;
      if (!result.ok) {
        setLocate({
          kind: "problem",
          title: t[result.problem.titleKey],
          body: t[result.problem.messageKey],
          canRetry: result.problem.canRetry,
        });
        return;
      }

      const deviceLocation = result.location;
      if (!recordDeviceLocation(deviceLocation)) {
        setLocate({
          kind: "problem",
          title: t["location.superseded_title"],
          body: t["location.superseded_body"],
          canRetry: true,
        });
        return;
      }
      const coords = { lat: deviceLocation.lat, lng: deviceLocation.lng };

      try {
        // ADR-023: this coordinate is a physical device fix, and the server
        // boundary requires the concept to be named rather than inferred.
        const coverage = await getCoverageForPoint({
          ...coords,
          radiusKm,
          provenance: "device",
        });
        if (g !== generation.current) return;

        if (coverage.placesInRadius > 0) {
          setDeviceBrowsingLocation(deviceLocation, {
            areaName: coverage.nearestArea?.name ?? null,
            areaSlug: coverage.nearestArea?.slug ?? null,
          });
          commit(coords);
          return;
        }

        setLocate({
          kind: "outside",
          distanceKm: coverage.nearestArea?.distanceKm ?? null,
          nearest: coverage.nearestArea,
        });
      } catch {
        if (g !== generation.current) return;
        setLocate({
          kind: "problem",
          title: t["location.coverage_check_failed_title"],
          body: t["location.coverage_check_failed_body"],
          canRetry: true,
        });
      }
    });
  }, [
    radiusKm,
    recordDeviceLocation,
    setDeviceBrowsingLocation,
    commit,
    t,
  ]);

  const measureFrom = freshDeviceLocation ?? {
    lat: browsingLocation.lat,
    lng: browsingLocation.lng,
  };

  return {
    browsingLocation,
    tree,
    treeError,
    locate,
    lgaSlug,
    setLgaSlug,
    loadTree,
    handlePickArea,
    handleUseMyLocation,
    measureFrom,
  };
}

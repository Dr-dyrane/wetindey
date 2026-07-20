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
import { copy } from "../copy/copy";

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
      setTreeError(copy.loadError);
    }
  }, []);

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
          title: result.problem.title,
          body: result.problem.message,
          canRetry: result.problem.canRetry,
        });
        return;
      }

      const deviceLocation = result.location;
      if (!recordDeviceLocation(deviceLocation)) {
        setLocate({
          kind: "problem",
          title: "A newer location is already active",
          body: "This older response was ignored. Try again if you want another refresh.",
          canRetry: true,
        });
        return;
      }
      const coords = { lat: deviceLocation.lat, lng: deviceLocation.lng };

      try {
        const coverage = await getCoverageForPoint({ ...coords, radiusKm });
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
          title: "We found you, but not our data",
          body: "Your current location is saved for this session, but we couldn't check nearby price coverage. Try again.",
          canRetry: true,
        });
      }
    });
  }, [
    radiusKm,
    recordDeviceLocation,
    setDeviceBrowsingLocation,
    commit,
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

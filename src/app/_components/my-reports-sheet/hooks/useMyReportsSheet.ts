import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useT,
  getMyReports,
  type MyReport,
} from "../imports/imports";

export interface UseMyReportsSheetOptions {
  open: boolean;
  signedIn: boolean;
  onReportPrice: () => void;
}

export function useMyReportsSheet({
  open,
  signedIn,
  onReportPrice,
}: UseMyReportsSheetOptions) {
  const t = useT();
  const [reports, setReports] = useState<MyReport[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generation = useRef(0);

  const load = useCallback(async () => {
    const g = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await getMyReports();
      if (g !== generation.current) return;
      setReports(rows);
    } catch (err) {
      console.error("MyReportsSheet: failed to load reports", err);
      if (g !== generation.current) return;
      setError(t("reports.err_load"));
    } finally {
      if (g === generation.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [open, load]);

  return {
    t,
    reports,
    error,
    loading,
    load,
    signedIn,
    onReportPrice,
  };
}

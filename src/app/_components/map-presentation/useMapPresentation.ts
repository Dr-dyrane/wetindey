import { useState, useLayoutEffect, useRef } from "react";

export function useMapPresentation() {
  const insetProbeRef = useRef<HTMLDivElement>(null);
  const [leadingInset, setLeadingInset] = useState(0);

  useLayoutEffect(() => {
    const el = insetProbeRef.current;
    if (!el) return;
    const measure = () => setLeadingInset(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isRegular = leadingInset > 0;

  return {
    insetProbeRef,
    leadingInset,
    isRegular
  };
}

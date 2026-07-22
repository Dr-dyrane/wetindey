import { useEffect, useState } from "../imports/imports";
import type { CrossCategorySignal } from "../CrossCategorySignalRail";

interface UseCrossCategorySignalRailProps {
  signals: readonly CrossCategorySignal[];
  rotationMs: number;
}

export function useCrossCategorySignalRail({
  signals,
  rotationMs,
}: UseCrossCategorySignalRailProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex((current) => (signals.length === 0 ? 0 : current % signals.length));
  }, [signals.length]);

  useEffect(() => {
    if (paused || signals.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % signals.length);
    }, rotationMs);
    return () => window.clearInterval(timer);
  }, [paused, signals.length, rotationMs]);

  return {
    index,
    paused,
    setPaused,
  };
}

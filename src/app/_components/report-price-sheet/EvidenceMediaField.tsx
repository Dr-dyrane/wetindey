"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/design-system/components/Button";
import { attachEvidenceMedia } from "@/app/_actions/evidence-media-actions";
import { isEvidenceMediaClientEnabled } from "@/lib/evidence-media/flag";
import { EVIDENCE_MEDIA_MIMES } from "@/lib/evidence-media/types";

type FieldState =
  | { phase: "idle" }
  | { phase: "attaching" }
  | { phase: "attached" }
  | { phase: "error" };

/**
 * Optional evidence-media control for an admitted report.
 *
 * DEFAULT-OFF: renders nothing unless the client flag is set AND a report has
 * been admitted (an `observationId` exists). A photo is never required. On
 * select the file is sent to the fail-closed server action, which sanitizes it
 * (EXIF/GPS stripped), stores it PRIVATELY, and holds it `pending`; nothing here
 * is public and nothing displays until an authorized moderation decision. The
 * control adds no status region with side margins, so the sheet layout is
 * unchanged when it is off.
 */
export function EvidenceMediaField({ observationId }: { observationId: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FieldState>({ phase: "idle" });

  if (!isEvidenceMediaClientEnabled() || !observationId) return null;

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setState({ phase: "attaching" });
    try {
      const formData = new FormData();
      formData.set("observationId", observationId);
      formData.set("media", file);
      const result = await attachEvidenceMedia(formData);
      setState(result.ok ? { phase: "attached" } : { phase: "error" });
    } catch {
      setState({ phase: "error" });
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-footnote text-text-secondary">Photo (optional)</span>
      <input
        ref={inputRef}
        type="file"
        accept={EVIDENCE_MEDIA_MIMES.join(",")}
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="secondary"
        size="md"
        className="w-full"
        disabled={state.phase === "attaching"}
        isLoading={state.phase === "attaching"}
        onClick={() => inputRef.current?.click()}
      >
        {state.phase === "attached" ? "Photo added" : "Add a photo"}
      </Button>
      {state.phase === "error" && (
        <span className="block text-footnote text-status-caution-fg">
          That photo could not be added. You can submit without one.
        </span>
      )}
    </div>
  );
}

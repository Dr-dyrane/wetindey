"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListGroup } from "@/design-system/components/ListRow";
import { Input } from "@/design-system/components/Input";
import { Button } from "@/design-system/components/Button";
import { useT } from "@/core/i18n";
import { authClient } from "@/lib/auth-client";
import { getMyProfile, updateMyProfile, type MyProfile } from "@/app/actions";
import { Avatar } from "@/app/_components/ProfileSheet";

/**
 * Manage profile: the editable half of the account.
 *
 * WHAT WRITES WHERE, AND WHY IT IS SPLIT. Three fields, three destinations:
 *
 *   · NAME lives in `neon_auth.user`, which this app cannot write through
 *     Drizzle, so it round-trips client-side via `authClient.updateUser({ name })`.
 *     On success the session is re-read (`onSessionChange`) so the map-header
 *     avatar and the mini-profile pick up the new initials.
 *   · EMAIL is DISPLAY-ONLY, and that is a hard SDK limit rather than a choice.
 *     `authClient.changeEmail` targets a route this Neon branch does not mount
 *     (the string "change-email" appears nowhere in @neondatabase/auth), so an
 *     editable field would POST to a 404, a dead control, which this codebase
 *     refuses to ship. `email_readonly_note` says WHY in the UI, and never
 *     promises a change flow it cannot deliver.
 *   · CONTACT is the user's OWN reachable channel and is the one thing this app
 *     owns end-to-end: it round-trips through `updateMyProfile` into our
 *     `user_profiles` table. It is NOT the seller/stall contact on `places`.
 *
 * ONE CHANNEL, KIND-THEN-VALUE. The segmented control always carries a selected
 * kind; the VALUE is what decides whether a channel exists at all. A non-empty
 * value saves `{ kind, value }`; clearing the value saves `{ null, null }`. That
 * is what keeps the server's both-or-neither rule satisfied without a validation
 * error the user has to decode.
 */
type ContactKind = "phone" | "whatsapp" | "sms";

function isContactKind(v: string | null): v is ContactKind {
  return v === "phone" || v === "whatsapp" || v === "sms";
}

/**
 * Segmented control, matching the platform's own. Sheets are never dropdowns, so a
 * three-way choice is a segmented control, not a native <select>. Mirrors the one
 * in `SettingsSheet`; it wants to collapse into a shared design-system component
 * the day the same hand holds both files.
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="m-3 grid gap-1 squircle bg-fillTertiary p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex items-center justify-center gap-1.5 squircle py-1.5 text-[13px] font-medium transition duration-micro
              ${active ? "bg-surface text-text-primary shadow-card" : "text-text-secondary active:opacity-60"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A ring without a stroke, so the no-border rule holds while a load is in flight.
 *  Same conic-mask trick as Button's `isLoading` arc. */
function Spinner() {
  return (
    <span
      aria-hidden
      className="h-5 w-5 animate-spin squircle-full text-text-secondary"
      style={{
        background: "conic-gradient(from 0deg, transparent 0turn, currentColor 1turn)",
        WebkitMask:
          "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
        mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
      }}
    />
  );
}

export function ManageProfileSheet({
  open,
  onClose,
  user,
  onSessionChange,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * The signed-in identity, from the same `sessionUser` the map header reads.
   * Only a defensive fallback for the seed: `getMyProfile` reads name/email off
   * the session server-side and is the authority. The row that opens this sheet
   * is signed-in-only, so `null` is a floor that should not arrive in practice.
   */
  user: { name: string; email: string } | null;
  /** Re-read the session after a name change so the avatar/mini-profile update. */
  onSessionChange: () => void;
}) {
  const t = useT();

  /** The committed baseline. Dirtiness is measured against this, and a successful
   *  save rebases it so the form settles back to clean. */
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactKind, setContactKind] = useState<ContactKind>("phone");
  const [contactValue, setContactValue] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  /**
   * The `user` prop is a fallback the loader reads through a ref, never a
   * dependency. Saving a name calls `onSessionChange`, which refetches the
   * session and hands this sheet a NEW `user` object; if the loader depended on
   * it, that refetch would re-run the load, re-seed the form, and wipe the
   * "Saved" confirmation the same beat it appeared. The ref keeps the loader
   * stable so the success state survives its own side effect.
   */
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /** Drops the result of a load the user walked away from, same generation
   *  counter as MyReportsSheet / LocationSheet and for the same reason. */
  const generation = useRef(0);

  const load = useCallback(async () => {
    const g = ++generation.current;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setJustSaved(false);
    try {
      const p = await getMyProfile();
      if (g !== generation.current) return;
      const resolved: MyProfile = p ?? {
        name: userRef.current?.name ?? "",
        email: userRef.current?.email ?? "",
        contactChannelKind: null,
        contactChannelValue: null,
      };
      setProfile(resolved);
      setName(resolved.name);
      setContactKind(isContactKind(resolved.contactChannelKind) ? resolved.contactChannelKind : "phone");
      setContactValue(resolved.contactChannelValue ?? "");
    } catch (err) {
      console.error("ManageProfileSheet: failed to load profile", err);
      if (g !== generation.current) return;
      setLoadError(t("profile.load_error"));
    } finally {
      if (g === generation.current) setLoading(false);
    }
  }, [t]);

  // Refetch on every present: a stale name or contact on a screen built to edit
  // them is the one thing it must not show.
  useEffect(() => {
    if (!open) return;
    void load();
    return () => {
      // Bumping the LIVE counter at dismissal is what makes an in-flight request
      // compare unequal and drop its result. See MyReportsSheet for the full note.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [open, load]);

  // The payload the form would send, and the baseline it is compared against.
  // A blank value clears the channel (both null), which is how the server's
  // both-or-neither rule is honoured without surfacing a validation error.
  const trimmedName = name.trim();
  const trimmedValue = contactValue.trim();
  const nextKind: ContactKind | null = trimmedValue ? contactKind : null;
  const nextValue: string | null = trimmedValue || null;

  const storedValue = profile?.contactChannelValue ?? null;
  const storedKind = storedValue ? (profile?.contactChannelKind ?? null) : null;

  const nameDirty = profile ? trimmedName !== profile.name : false;
  const contactDirty = profile ? nextValue !== storedValue || nextKind !== storedKind : false;
  const isDirty = nameDirty || contactDirty;

  const showForm = !loading && !loadError && profile !== null;
  const canSave = showForm && isDirty && !saving;

  async function save() {
    if (!profile || !isDirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setJustSaved(false);
    try {
      if (nameDirty) {
        const { error } = await authClient.updateUser({ name: trimmedName });
        if (error) {
          console.error("ManageProfileSheet: updateUser rejected", error);
          setSaveError(t("profile.save_error"));
          setSaving(false);
          return;
        }
      }
      if (contactDirty) {
        await updateMyProfile({ contactChannelKind: nextKind, contactChannelValue: nextValue });
      }
      // Only a name touches the session; the avatar and mini-profile read from it.
      if (nameDirty) onSessionChange();
      // Rebase so the form is clean and Save disables until the next edit.
      setProfile({
        name: trimmedName,
        email: profile.email,
        contactChannelKind: nextKind,
        contactChannelValue: nextValue,
      });
      setName(trimmedName);
      setContactValue(nextValue ?? "");
      if (nextKind) setContactKind(nextKind);
      setJustSaved(true);
    } catch (err) {
      console.error("ManageProfileSheet: failed to save profile", err);
      setSaveError(t("profile.save_error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={t("profile.manage")}
      size="form"
      action={
        showForm ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => void save()}
            isLoading={saving}
            disabled={!canSave}
          >
            {t("profile.save")}
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner />
        </div>
      ) : loadError ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-body text-text-secondary">{loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            {t("auth.retry")}
          </Button>
        </div>
      ) : profile ? (
        <div className="space-y-6 py-4">
          {/* Identity anchor. Initials update live as the name is typed; the avatar
              has no upload affordance yet (deferred to the image-CRUD phase). */}
          <div className="flex justify-center px-4">
            <Avatar name={name || profile.email || undefined} size={64} />
          </div>

          <ListGroup header={t("profile.name_label")}>
            <div className="p-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("profile.name_label")}
                aria-label={t("profile.name_label")}
                autoComplete="name"
                maxLength={80}
              />
            </div>
          </ListGroup>

          {/* Email is the sign-in identity and cannot be edited here: read-only
              text, not an Input, with the note saying why. */}
          <ListGroup header={t("profile.email_label")} footer={t("profile.email_readonly_note")}>
            <div className="px-4 py-3">
              <p className="break-words text-body text-text-primary">{profile.email}</p>
            </div>
          </ListGroup>

          <ListGroup header={t("profile.contact_label")}>
            <Segmented<ContactKind>
              value={contactKind}
              onChange={setContactKind}
              options={[
                { id: "phone", label: t("profile.contact_kind_phone") },
                { id: "whatsapp", label: t("profile.contact_kind_whatsapp") },
                { id: "sms", label: t("profile.contact_kind_sms") },
              ]}
            />
            <div className="px-3 pb-3">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={t("profile.contact_placeholder")}
                aria-label={t("profile.contact_label")}
                maxLength={255}
              />
            </div>
          </ListGroup>

          {justSaved && !isDirty && (
            <p role="status" className="px-4 text-center text-footnote text-status-confirmed-fg">
              {t("profile.saved")}
            </p>
          )}
          {saveError && (
            <p role="alert" className="px-4 text-center text-footnote text-status-unavailable">
              {saveError}
            </p>
          )}
        </div>
      ) : null}
    </ModalSheet>
  );
}

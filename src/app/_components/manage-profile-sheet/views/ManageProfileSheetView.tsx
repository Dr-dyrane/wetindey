import {
  React,
  Camera,
  ModalSheet,
  ListGroup,
  Input,
  Button,
  Avatar,
} from "../imports/imports";
import { type ContactKind, type useManageProfileSheet } from "../hooks/useManageProfileSheet";
import "../styles/ManageProfileSheet.css";

export interface ManageProfileSheetViewProps {
  open: boolean;
  onClose: () => void;
  sheet: ReturnType<typeof useManageProfileSheet>;
}

export function ManageProfileSheetView({
  open,
  onClose,
  sheet,
}: ManageProfileSheetViewProps) {
  const {
    t,
    profile,
    loading,
    loadError,
    name,
    setName,
    contactKind,
    setContactKind,
    contactValue,
    setContactValue,
    saving,
    saveError,
    justSaved,
    fileInputRef,
    avatarBusy,
    avatarError,
    showForm,
    canSave,
    isDirty,
    load,
    save,
    handleAvatarUpload,
    handleAvatarRemove,
  } = sheet;

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
          <div className="flex flex-col items-center gap-2.5 px-4">
            <div className="relative group">
              <button
                type="button"
                disabled={Boolean(avatarBusy)}
                onClick={() => fileInputRef.current?.click()}
                className="relative block rounded-full focus:outline-none focus-ring"
                aria-label="Change profile photo"
              >
                <Avatar name={name || profile.email || undefined} url={profile.avatarUrl} size={80} />
                <div className="absolute inset-0 grid place-items-center bg-media-scrim/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-micro">
                  <Camera className="h-6 w-6 text-media-ink" />
                </div>
                {avatarBusy && (
                  <div className="absolute inset-0 grid place-items-center bg-media-scrim/50 rounded-full">
                    <Spinner />
                  </div>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
              />
            </div>
            {profile.avatarUrl && !avatarBusy && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                className="text-[13px] font-medium text-status-unavailable active:opacity-60 transition duration-micro"
              >
                Remove photo
              </button>
            )}
            {avatarError && (
              <p role="alert" className="text-footnote text-status-unavailable text-center max-w-[280px]">
                {avatarError}
              </p>
            )}
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

          <ListGroup header={t("profile.nearby_presence")}>
            <div className="flex min-h-tap items-center justify-between px-4 py-2">
              <span className="text-body text-text-primary">{t("profile.not_available_yet")}</span>
              <span
                aria-label={t("profile.not_available_yet")}
                className="squircle bg-fillTertiary px-3 py-1.5 text-footnote font-medium text-text-secondary"
              >
                {t("profile.not_available_yet")}
              </span>
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

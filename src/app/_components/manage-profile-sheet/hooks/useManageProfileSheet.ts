import {
  React,
  useCallback,
  useEffect,
  useRef,
  useState,
  useT,
  authClient,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  removeMyAvatar,
  haptics,
  type MyProfile,
} from "../imports/imports";
import { copy } from "../copy/copy";

export type ContactKind = "phone" | "whatsapp" | "sms";

export function isContactKind(v: string | null): v is ContactKind {
  return v === "phone" || v === "whatsapp" || v === "sms";
}

// Mirror the server's own avatar constraints so the size/type message only ever
// shows for a file that truly violates it (see uploadMyAvatar in profile-actions).
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface UseManageProfileSheetOptions {
  open: boolean;
  user: { name: string; email: string } | null;
  onSessionChange: () => void;
}

export function useManageProfileSheet({
  open,
  user,
  onSessionChange,
}: UseManageProfileSheetOptions) {
  const t = useT();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactKind, setContactKind] = useState<ContactKind>("phone");
  const [contactValue, setContactValue] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState<"upload" | "remove" | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
        avatarUrl: null,
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

  useEffect(() => {
    if (!open) return;
    void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [open, load]);

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
      if (nameDirty) onSessionChange();
      setProfile({
        ...profile,
        name: trimmedName,
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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    haptics.selection();

    // Client-side precheck: the size/type message is honest only when the file
    // actually violates it. Everything past this point is a network/server fault.
    if (!AVATAR_ALLOWED_TYPES.includes(file.type) || file.size > AVATAR_MAX_BYTES) {
      setAvatarError(copy.avatarSizeError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setAvatarBusy("upload");
    setAvatarError(null);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await uploadMyAvatar(formData);
      setProfile((prev) => (prev ? { ...prev, avatarUrl: res.avatarUrl } : null));
      onSessionChange();
    } catch (err) {
      console.error("ManageProfileSheet: failed to upload avatar", err);
      // The precheck already ruled out size/type, so this is a network or server
      // fault. Show an honest generic failure, never the misleading size message.
      setAvatarError(t("profile.save_error"));
    } finally {
      setAvatarBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    haptics.selection();
    setAvatarBusy("remove");
    setAvatarError(null);

    try {
      await removeMyAvatar();
      setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : null));
      onSessionChange();
    } catch (err) {
      console.error("ManageProfileSheet: failed to remove avatar", err);
      setAvatarError(copy.avatarRemoveError);
    } finally {
      setAvatarBusy(null);
    }
  }

  return {
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
  };
}

"use server";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { put, del } from "@vercel/blob";
import { parseUpdateMyProfile } from "@/lib/validation";

export interface MyProfile {
  name: string;
  email: string;
  contactChannelKind: "phone" | "whatsapp" | "sms" | null;
  contactChannelValue: string | null;
  avatarUrl: string | null;
}

export interface SharedUserLocation {
  userId: string;
  name: string;
  avatarUrl: string | null;
  latitude: number;
  longitude: number;
  contactChannelKind: string | null;
  contactChannelValue: string | null;
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const [row] = await db
    .select({
      contactChannelKind: userProfiles.contactChannelKind,
      contactChannelValue: userProfiles.contactChannelValue,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const kind = row?.contactChannelKind;
  const validKind = kind === "phone" || kind === "whatsapp" || kind === "sms" ? kind : null;

  return {
    name: user.name ?? "",
    email: user.email,
    contactChannelKind: validKind,
    contactChannelValue: row?.contactChannelValue ?? null,
    avatarUrl: row?.avatarUrl ?? null,
  };
}

export async function updateMyProfile(data: {
  contactChannelKind?: "phone" | "whatsapp" | "sms" | null;
  contactChannelValue?: string | null;
}): Promise<void> {
  const input = parseUpdateMyProfile(data);

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("updateMyProfile: no session, a profile write is owner-scoped");
  }

  const contactChannelKind = input.contactChannelKind ?? null;
  const contactChannelValue = input.contactChannelValue ?? null;

  await db
    .insert(userProfiles)
    .values({ userId, contactChannelKind, contactChannelValue })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { contactChannelKind, contactChannelValue, updatedAt: new Date() },
    });
}

const AVATAR_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export async function uploadMyAvatar(formData: FormData): Promise<{ avatarUrl: string }> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("uploadMyAvatar: no session, an avatar write is owner-scoped");
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("uploadMyAvatar: no avatar file was provided");
  }

  const ext = AVATAR_MIME_EXT[file.type];
  if (!ext) {
    throw new Error("uploadMyAvatar: avatar must be a PNG, JPEG, or WebP image");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("uploadMyAvatar: avatar must be at most 2MB");
  }

  const [existing] = await db
    .select({ avatarUrl: userProfiles.avatarUrl })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const blob = await put(`avatars/${userId}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  await db
    .insert(userProfiles)
    .values({ userId, avatarUrl: blob.url })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { avatarUrl: blob.url, updatedAt: new Date() },
    });

  if (existing?.avatarUrl && existing.avatarUrl !== blob.url) {
    try {
      await del(existing.avatarUrl);
    } catch {
      // Stale blob cleanup failure non-fatal
    }
  }

  return { avatarUrl: blob.url };
}

export async function removeMyAvatar(): Promise<void> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("removeMyAvatar: no session, an avatar write is owner-scoped");
  }

  const [existing] = await db
    .select({ avatarUrl: userProfiles.avatarUrl })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!existing?.avatarUrl) return;

  await db
    .update(userProfiles)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId));

  try {
    await del(existing.avatarUrl);
  } catch {
    // Best-effort cleanup
  }
}

export async function getSharedUserLocations(): Promise<SharedUserLocation[]> {
  return [];
}

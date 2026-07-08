import { clampImportance, createMemoryItem } from "@/lib/din/memory-priority";
import type { FollowUpRecallInput } from "@/types/follow-up";
import type { MemoryItem, MemoryMarkerUpdate } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

const MEMORY_MARKER_PATTERN = /\[\[MEMORY:(\{[\s\S]*?\})\]\]\s*$/;

function applyProfileUpdates(
  current: UserProfile,
  updates: MemoryMarkerUpdate,
): UserProfile {
  const next: UserProfile = {
    occupation: current.occupation,
    hobbies: [...current.hobbies],
    favoriteFoods: [...current.favoriteFoods],
    birthday: current.birthday,
  };

  if (typeof updates.birthday === "string" && updates.birthday.trim()) {
    next.birthday = updates.birthday.trim();
  }

  if (typeof updates.occupation === "string" && updates.occupation.trim()) {
    next.occupation = updates.occupation.trim();
  }

  if (Array.isArray(updates.hobbies)) {
    for (const hobby of updates.hobbies) {
      const trimmed = hobby.trim();
      if (trimmed && !next.hobbies.includes(trimmed)) {
        next.hobbies.push(trimmed);
      }
    }
  }

  if (Array.isArray(updates.favoriteFoods)) {
    for (const food of updates.favoriteFoods) {
      const trimmed = food.trim();
      if (trimmed && !next.favoriteFoods.includes(trimmed)) {
        next.favoriteFoods.push(trimmed);
      }
    }
  }

  return next;
}

function hasProfileChanges(before: UserProfile, after: UserProfile): boolean {
  return (
    before.occupation !== after.occupation ||
    before.hobbies.join("\u0000") !== after.hobbies.join("\u0000") ||
    before.favoriteFoods.join("\u0000") !== after.favoriteFoods.join("\u0000") ||
    before.birthday !== after.birthday
  );
}

function buildMemoryItemsFromMarker(updates: MemoryMarkerUpdate): MemoryItem[] {
  const items: MemoryItem[] = [];

  if (Array.isArray(updates.longTerm)) {
    for (const entry of updates.longTerm) {
      const content = entry.content?.trim();
      if (!content) continue;

      items.push(
        createMemoryItem({
          kind: "long_term",
          content,
          importance: entry.importance,
          category: entry.category ?? "general",
          source: "conversation",
        }),
      );
    }
  }

  if (Array.isArray(updates.shortTerm)) {
    for (const entry of updates.shortTerm) {
      const content = entry.content?.trim();
      if (!content) continue;

      items.push(
        createMemoryItem({
          kind: "short_term",
          content,
          importance: entry.importance,
          expiresAt: entry.expiresAt,
          category: entry.category ?? "context",
          source: "conversation",
        }),
      );
    }
  }

  if (typeof updates.occupation === "string" && updates.occupation.trim()) {
    items.push(
      createMemoryItem({
        kind: "long_term",
        content: `職業は${updates.occupation.trim()}`,
        importance: 4,
        category: "occupation",
        source: "conversation",
      }),
    );
  }

  for (const hobby of updates.hobbies ?? []) {
    const trimmed = hobby.trim();
    if (!trimmed) continue;

    items.push(
      createMemoryItem({
        kind: "long_term",
        content: `趣味は${trimmed}`,
        importance: 3,
        category: "hobby",
        source: "conversation",
      }),
    );
  }

  for (const food of updates.favoriteFoods ?? []) {
    const trimmed = food.trim();
    if (!trimmed) continue;

    items.push(
      createMemoryItem({
        kind: "long_term",
        content: `好きなものは${trimmed}`,
        importance: 3,
        category: "favorite",
        source: "conversation",
      }),
    );
  }

  if (typeof updates.birthday === "string" && updates.birthday.trim()) {
    items.push(
      createMemoryItem({
        kind: "long_term",
        content: `誕生日は${updates.birthday.trim()}`,
        importance: 5,
        category: "profile",
        source: "conversation",
      }),
    );
  }

  return items;
}

function buildFollowUpRecallsFromMarker(
  updates: MemoryMarkerUpdate,
): FollowUpRecallInput[] {
  if (!Array.isArray(updates.followUp)) return [];

  const recalls: FollowUpRecallInput[] = [];

  for (const entry of updates.followUp) {
    const content = entry.content?.trim();
    if (!content) continue;

    recalls.push({
      content,
      importance: entry.importance ? clampImportance(entry.importance) : undefined,
    });
  }

  return recalls;
}

export function parseMemoryFromResponse(
  content: string,
  currentProfile: UserProfile,
): {
  content: string;
  remembered: boolean;
  profile: UserProfile;
  newMemoryItems: MemoryItem[];
  newFollowUpRecalls: FollowUpRecallInput[];
} {
  const match = content.match(MEMORY_MARKER_PATTERN);

  if (!match) {
    return {
      content: content.trim(),
      remembered: false,
      profile: currentProfile,
      newMemoryItems: [],
      newFollowUpRecalls: [],
    };
  }

  const cleanedContent = content.replace(MEMORY_MARKER_PATTERN, "").trim();

  try {
    const updates = JSON.parse(match[1]) as MemoryMarkerUpdate;
    const profile = applyProfileUpdates(currentProfile, updates);
    const newMemoryItems = buildMemoryItemsFromMarker(updates);
    const newFollowUpRecalls = buildFollowUpRecallsFromMarker(updates);
    const remembered =
      hasProfileChanges(currentProfile, profile) ||
      newMemoryItems.length > 0 ||
      newFollowUpRecalls.length > 0;

    return {
      content: cleanedContent,
      remembered,
      profile,
      newMemoryItems,
      newFollowUpRecalls,
    };
  } catch {
    return {
      content: cleanedContent,
      remembered: false,
      profile: currentProfile,
      newMemoryItems: [],
      newFollowUpRecalls: [],
    };
  }
}

import { createMemoryItem } from "@/lib/din/memory-priority";
import type { DinMemory } from "@/types/din-memory";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

/** ユーザーの誕生日（暦日・JST基準。タイムゾーンずれで日付がずれないよう固定） */
export const USER_BIRTHDAY = "7月7日";

const WRONG_BIRTHDAY_PATTERN = /^(?:7月8|7\/8|07-08|07\/08)/;

export function normalizeBirthday(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || WRONG_BIRTHDAY_PATTERN.test(trimmed)) {
    return USER_BIRTHDAY;
  }
  return trimmed;
}

export function migrateBirthdayMemoryItems(items: MemoryItem[]): MemoryItem[] {
  return items.map((item) => {
    if (!/誕生日/.test(item.content) || !/7月8|7\/8/.test(item.content)) {
      return item;
    }

    return {
      ...item,
      content: item.content
        .replace(/7月8日?/g, USER_BIRTHDAY)
        .replace(/7\/8/g, USER_BIRTHDAY),
    };
  });
}

function hasBirthdayMemory(items: readonly MemoryItem[]): boolean {
  return items.some((item) => /誕生日/.test(item.content));
}

export function normalizeUserProfile(profile?: Partial<UserProfile>): UserProfile {
  return {
    occupation: profile?.occupation ?? "",
    hobbies: Array.isArray(profile?.hobbies)
      ? profile.hobbies.filter((item) => typeof item === "string")
      : [],
    favoriteFoods: Array.isArray(profile?.favoriteFoods)
      ? profile.favoriteFoods.filter((item) => typeof item === "string")
      : [],
    birthday: normalizeBirthday(profile?.birthday),
  };
}

/** 誕生日の誤記憶（7月8日）を修正し、プロフィールと長期記憶に 7月7日 を載せる */
export function migrateBirthdayMemory(memory: DinMemory): DinMemory {
  const profile = normalizeUserProfile(memory.profile);
  const longTermMemories = migrateBirthdayMemoryItems(memory.longTermMemories);
  const shortTermMemories = migrateBirthdayMemoryItems(memory.shortTermMemories);

  if (hasBirthdayMemory(longTermMemories)) {
    return {
      ...memory,
      profile,
      longTermMemories,
      shortTermMemories,
    };
  }

  return {
    ...memory,
    profile,
    longTermMemories: [
      ...longTermMemories,
      createMemoryItem({
        kind: "long_term",
        content: `誕生日は${USER_BIRTHDAY}`,
        importance: 5,
        category: "profile",
        source: "manual",
      }),
    ],
    shortTermMemories,
  };
}

import { createMemoryItem } from "@/lib/din/memory-priority";
import type { MemoryItem } from "@/types/memory-item";
import type { UserProfile } from "@/types/user-profile";

/** ユーザーが明示的に記憶を依頼している */
const REMEMBER_REQUEST_PATTERN =
  /覚えて(?:おいて|て|とく|といて|ろ)?|覚えと(?:いて|く)?|記憶して(?:おいて)?|忘れないで|メモして(?:おいて)?/i;

const REMEMBER_REQUEST_STRIP_PATTERN =
  /(?:^|[、。\s]+)?(?:覚えて(?:おいて|て|とく|といて|ろ)?(?:ね|よ|な|わ)?|覚えと(?:いて|く)?(?:ね|よ)?|記憶して(?:おいて)?(?:ね|よ)?|忘れないで(?:ね|よ)?|メモして(?:おいて)?(?:ね|よ)?)(?:[、。\s]+|$)/gi;

const BIRTHDAY_FACT_PATTERN =
  /(?:誕生日|たんじょうび|バースデー)(?:は|が)?\s*(\d{1,2}月\d{1,2}日?)/i;

const OCCUPATION_FACT_PATTERN =
  /(?:私|わたし|僕)(?:は|の)\s*(.{1,40}?)(?:なんだ|なんです|だよ|です|している|してる|だった)/i;

const HOBBY_FACT_PATTERN = /趣味(?:は|が)\s*(.{1,40})/i;

const FAVORITE_FOOD_FACT_PATTERN = /好きな(?:もの|食べ物|フード)(?:は|が)\s*(.{1,40})/i;

function trimTrailingParticles(value: string): string {
  return value.replace(/(?:だよ|です|だね|ね|よ|な|わ)[。、！!？?]*$/u, "").trim();
}

export function isRememberRequest(input: string): boolean {
  const normalized = input.trim();
  if (!normalized) return false;
  return REMEMBER_REQUEST_PATTERN.test(normalized);
}

export function extractRememberableFact(
  userInput: string,
  recentUserInputs: readonly string[] = [],
): string | null {
  const normalized = userInput.trim();
  if (!normalized || !isRememberRequest(normalized)) return null;

  let fact = normalized.replace(REMEMBER_REQUEST_STRIP_PATTERN, "").trim();
  fact = fact.replace(/^[、。.\s]+/, "").replace(/[、。.\s]+$/, "");
  fact = fact.replace(/だから$/, "").trim();

  if (fact.length >= 2) return fact;

  for (let index = recentUserInputs.length - 2; index >= 0; index -= 1) {
    const candidate = recentUserInputs[index]?.trim() ?? "";
    if (!candidate || isRememberRequest(candidate)) continue;
    if (candidate.length >= 4) return candidate;
  }

  return null;
}

function applyProfileFactToMemory(
  fact: string,
  profile: UserProfile,
  items: MemoryItem[],
): UserProfile {
  const next: UserProfile = {
    occupation: profile.occupation,
    hobbies: [...profile.hobbies],
    favoriteFoods: [...profile.favoriteFoods],
    birthday: profile.birthday,
  };

  const birthdayMatch = fact.match(BIRTHDAY_FACT_PATTERN);
  if (birthdayMatch) {
    const birthday = birthdayMatch[1].trim();
    if (birthday && birthday !== next.birthday) {
      next.birthday = birthday;
      items.push(
        createMemoryItem({
          kind: "long_term",
          content: `誕生日は${birthday}`,
          importance: 5,
          category: "profile",
          source: "conversation",
        }),
      );
    }
    return next;
  }

  const occupationMatch = fact.match(OCCUPATION_FACT_PATTERN);
  if (occupationMatch) {
    const occupation = occupationMatch[1].trim();
    if (occupation && occupation !== next.occupation) {
      next.occupation = occupation;
      items.push(
        createMemoryItem({
          kind: "long_term",
          content: `職業は${occupation}`,
          importance: 4,
          category: "occupation",
          source: "conversation",
        }),
      );
    }
    return next;
  }

  const hobbyMatch = fact.match(HOBBY_FACT_PATTERN);
  if (hobbyMatch) {
    const hobby = trimTrailingParticles(
      hobbyMatch[1].replace(/[。、！!？?]+$/, "").trim(),
    );
    if (hobby && !next.hobbies.includes(hobby)) {
      next.hobbies.push(hobby);
      items.push(
        createMemoryItem({
          kind: "long_term",
          content: `趣味は${hobby}`,
          importance: 3,
          category: "hobby",
          source: "conversation",
        }),
      );
    }
    return next;
  }

  const favoriteMatch = fact.match(FAVORITE_FOOD_FACT_PATTERN);
  if (favoriteMatch) {
    const favorite = trimTrailingParticles(
      favoriteMatch[1].replace(/[。、！!？?]+$/, "").trim(),
    );
    if (favorite && !next.favoriteFoods.includes(favorite)) {
      next.favoriteFoods.push(favorite);
      items.push(
        createMemoryItem({
          kind: "long_term",
          content: `好きなものは${favorite}`,
          importance: 3,
          category: "favorite",
          source: "conversation",
        }),
      );
    }
    return next;
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

/** モデルがマーカーを付け忘れたとき、明示的な記憶依頼をサーバー側で補完する */
export function applyRememberRequestFallback(input: {
  content: string;
  remembered: boolean;
  profile: UserProfile;
  newMemoryItems: MemoryItem[];
  userInput: string;
  recentUserInputs?: readonly string[];
}): {
  content: string;
  remembered: boolean;
  profile: UserProfile;
  newMemoryItems: MemoryItem[];
} {
  if (input.remembered) return input;
  if (!isRememberRequest(input.userInput)) return input;

  const fact = extractRememberableFact(
    input.userInput,
    input.recentUserInputs ?? [],
  );
  if (!fact) return input;

  const newMemoryItems = [...input.newMemoryItems];
  const profile = applyProfileFactToMemory(fact, input.profile, newMemoryItems);
  const profileUpdated = hasProfileChanges(input.profile, profile);

  if (!profileUpdated) {
    const alreadyStored = newMemoryItems.some((item) => item.content === fact);
    if (!alreadyStored) {
      newMemoryItems.push(
        createMemoryItem({
          kind: "long_term",
          content: fact,
          importance: 4,
          category: "general",
          source: "conversation",
        }),
      );
    }
  }

  const remembered = profileUpdated || newMemoryItems.length > 0;

  if (!remembered) return input;

  return {
    content: input.content,
    remembered: true,
    profile,
    newMemoryItems,
  };
}

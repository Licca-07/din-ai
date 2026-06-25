import { generateId } from "@/lib/generate-id";
import type { MemoryImportance, MemoryItem, MemoryItemInput } from "@/types/memory-item";

export const PROMPT_MEMORY_CHAR_LIMIT = 1000;
export const LONG_TERM_PROMPT_LIMIT = 10;
export const SHORT_TERM_PROMPT_LIMIT = 5;
export const DEFAULT_SHORT_TERM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function clampImportance(value: number): MemoryImportance {
  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  return clamped as MemoryImportance;
}

export function createMemoryItem(
  input: MemoryItemInput,
  now = new Date(),
): MemoryItem {
  const iso = now.toISOString();
  const kind = input.kind ?? "long_term";

  return {
    id: generateId(),
    kind,
    content: input.content.trim(),
    importance: clampImportance(input.importance ?? (kind === "short_term" ? 2 : 3)),
    lastReferencedAt: iso,
    createdAt: iso,
    expiresAt:
      kind === "short_term"
        ? (input.expiresAt ??
          new Date(now.getTime() + DEFAULT_SHORT_TERM_TTL_MS).toISOString())
        : (input.expiresAt ?? null),
    embedding: null,
    metadata: input.metadata ?? {},
    source: input.source ?? "conversation",
    category: input.category ?? "general",
  };
}

export function isMemoryExpired(item: MemoryItem, now = new Date()): boolean {
  if (item.kind !== "short_term" || !item.expiresAt) return false;
  return new Date(item.expiresAt).getTime() <= now.getTime();
}

export function compareMemoryPriority(a: MemoryItem, b: MemoryItem): number {
  if (b.importance !== a.importance) {
    return b.importance - a.importance;
  }

  return (
    new Date(b.lastReferencedAt).getTime() -
    new Date(a.lastReferencedAt).getTime()
  );
}

export function sortLongTermMemories(items: MemoryItem[]): MemoryItem[] {
  return [...items]
    .filter((item) => item.kind === "long_term")
    .sort(compareMemoryPriority);
}

export function sortShortTermMemories(
  items: MemoryItem[],
  now = new Date(),
): MemoryItem[] {
  return [...items]
    .filter((item) => item.kind === "short_term" && !isMemoryExpired(item, now))
    .sort(compareMemoryPriority);
}

export function selectTopLongTermMemories(
  items: MemoryItem[],
  limit = LONG_TERM_PROMPT_LIMIT,
): MemoryItem[] {
  return sortLongTermMemories(items).slice(0, limit);
}

export function selectTopShortTermMemories(
  items: MemoryItem[],
  limit = SHORT_TERM_PROMPT_LIMIT,
  now = new Date(),
): MemoryItem[] {
  return sortShortTermMemories(items, now).slice(0, limit);
}

export function formatMemoryItemLine(item: MemoryItem): string {
  if (item.kind === "long_term") {
    return `- ${item.content} [重要度:${item.importance}]`;
  }

  return `- ${item.content}`;
}

function fitsCharBudget(current: string, nextLine: string, limit: number): boolean {
  const separator = current.length > 0 ? "\n" : "";
  return current.length + separator.length + nextLine.length <= limit;
}

function appendLinesWithinBudget(
  base: string,
  lines: string[],
  limit: number,
): { text: string; includedCount: number } {
  let text = base;
  let includedCount = 0;

  for (const line of lines) {
    if (!fitsCharBudget(text, line, limit)) break;
    text = text.length > 0 ? `${text}\n${line}` : line;
    includedCount += 1;
  }

  return { text, includedCount };
}

export type PromptMemorySelection = {
  text: string;
  referencedMemoryIds: string[];
};

export type BuildPromptMemoryInput = {
  profileSection: string;
  relationshipSection: string;
  longTermMemories: MemoryItem[];
  shortTermMemories: MemoryItem[];
  now?: Date;
};

/** 常時項目 + 優先度選定された長期/一時記憶を上限文字数内で組み立てる */
export function buildPromptMemorySection(
  input: BuildPromptMemoryInput,
): PromptMemorySelection {
  const now = input.now ?? new Date();
  const longTermCandidates = selectTopLongTermMemories(input.longTermMemories);
  const shortTermCandidates = selectTopShortTermMemories(
    input.shortTermMemories,
    SHORT_TERM_PROMPT_LIMIT,
    now,
  );

  const alwaysSection = [
    "## 記憶帳（内部参照用・返答に転記しない）",
    "### プロフィール",
    input.profileSection,
    "### 関係性",
    input.relationshipSection,
  ].join("\n");

  let text = alwaysSection;
  const referencedIds: string[] = [];

  const longTermHeader = "\n\n## 長期記憶";
  const longTermLines = longTermCandidates.map(formatMemoryItemLine);

  if (longTermLines.length > 0) {
    const withHeader = `${text}${longTermHeader}`;
    if (withHeader.length <= PROMPT_MEMORY_CHAR_LIMIT) {
      const { text: longTermText, includedCount } = appendLinesWithinBudget(
        withHeader,
        longTermLines,
        PROMPT_MEMORY_CHAR_LIMIT,
      );

      if (includedCount > 0) {
        text = longTermText;
        referencedIds.push(
          ...longTermCandidates.slice(0, includedCount).map((item) => item.id),
        );
      }
    }
  }

  const shortTermHeader = "\n\n## 一時記憶";
  const shortTermLines = shortTermCandidates.map(formatMemoryItemLine);

  if (shortTermLines.length > 0) {
    const withHeader = `${text}${shortTermHeader}`;
    if (withHeader.length <= PROMPT_MEMORY_CHAR_LIMIT) {
      const { text: shortTermText, includedCount } = appendLinesWithinBudget(
        withHeader,
        shortTermLines,
        PROMPT_MEMORY_CHAR_LIMIT,
      );

      if (includedCount > 0) {
        text = shortTermText;
        referencedIds.push(
          ...shortTermCandidates.slice(0, includedCount).map((item) => item.id),
        );
      }
    }
  }

  return { text, referencedMemoryIds: referencedIds };
}

import { generateId } from "@/lib/generate-id";
import { createChatMessageTimestamp } from "@/lib/din/chat-message-time";
import type { StoredChatMessage } from "@/types/din-memory";

const BUBBLE_REVEAL_MIN_MS = 500;
const BUBBLE_REVEAL_MAX_MS = 1500;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function randomBubbleRevealDelayMs(): number {
  return (
    BUBBLE_REVEAL_MIN_MS +
    Math.floor(Math.random() * (BUBBLE_REVEAL_MAX_MS - BUBBLE_REVEAL_MIN_MS + 1))
  );
}

/** Din の返答を1バブル1文に分割する */
export function splitDinResponseIntoBubbles(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/(?<=[。！？!?])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [trimmed];
}

type RevealAssistantBubblesOptions = {
  remembered?: boolean;
  onTypingChange: (typing: boolean) => void;
  appendMessage: (message: StoredChatMessage) => void;
  shouldCancel?: () => boolean;
};

/** 1回生成した返答を、文ごとに typing → 表示を繰り返す */
export async function revealAssistantBubbles(
  content: string,
  options: RevealAssistantBubblesOptions,
): Promise<void> {
  const bubbles = splitDinResponseIntoBubbles(content);
  if (bubbles.length === 0) return;

  for (let index = 0; index < bubbles.length; index += 1) {
    if (options.shouldCancel?.()) return;

    if (index > 0) {
      options.onTypingChange(true);
      await sleep(randomBubbleRevealDelayMs());

      if (options.shouldCancel?.()) {
        options.onTypingChange(false);
        return;
      }
    }

    options.appendMessage({
      id: generateId(),
      role: "assistant",
      content: bubbles[index],
      createdAt: createChatMessageTimestamp(),
      remembered:
        index === bubbles.length - 1 ? options.remembered : undefined,
    });
    options.onTypingChange(false);
  }
}

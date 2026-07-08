export type MemoryImportance = 1 | 2 | 3 | 4 | 5;

export type MemoryItemKind = "long_term" | "short_term";

/** ベクトル検索移行を見据えた記憶単位 */
export type MemoryItem = {
  id: string;
  kind: MemoryItemKind;
  content: string;
  importance: MemoryImportance;
  lastReferencedAt: string;
  createdAt: string;
  expiresAt: string | null;
  /** 将来: ベクトル検索用 embedding */
  embedding: number[] | null;
  /** 将来: フィルタ・検索用メタデータ */
  metadata: Record<string, string>;
  source: "profile" | "conversation" | "manual";
  category: string;
};

export type MemoryItemInput = {
  content: string;
  kind?: MemoryItemKind;
  importance?: MemoryImportance;
  expiresAt?: string | null;
  metadata?: Record<string, string>;
  source?: MemoryItem["source"];
  category?: string;
};

export type MemoryMarkerUpdate = {
  occupation?: string;
  hobbies?: string[];
  favoriteFoods?: string[];
  birthday?: string;
  longTerm?: Array<{
    content: string;
    importance?: MemoryImportance;
    category?: string;
  }>;
  shortTerm?: Array<{
    content: string;
    importance?: MemoryImportance;
    expiresAt?: string;
    category?: string;
  }>;
  followUp?: Array<{
    content: string;
    importance?: MemoryImportance;
  }>;
};

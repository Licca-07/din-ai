#!/usr/bin/env node

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

import {
  assertMemorySyncPayload,
  createMemorySyncTestPayload,
  formatMemorySummary,
  MEMORY_SYNC_TEST_MARKER,
} from "../src/lib/din/memory-sync-test";
import {
  fetchMemoryFromSupabase,
  upsertMemoryToSupabase,
} from "../src/lib/supabase/memory-repository";
import { isSupabaseConfigured } from "../src/lib/supabase/server";

type TestResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const results: TestResult[] = [];

function pass(name: string, detail: string): void {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}: ${detail}`);
}

function fail(name: string, detail: string): never {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
  printSummary();
  process.exit(1);
}

function printSummary(): void {
  console.log("");
  console.log("--- Summary ---");
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}`);
  }
}

function printCrossDeviceSteps(runId: string, baseUrl: string): void {
  console.log("");
  console.log("--- Manual check: Mac / iPhone sync (item 5) ---");
  console.log("1. Mac で dev サーバーを起動:");
  console.log("   npm run dev -- -H 0.0.0.0");
  console.log("2. Mac ブラウザでアプリを開き、ページをリロード");
  console.log(`3. iPhone Safari で ${baseUrl} を開く`);
  console.log("4. 記憶帳タブで会話回数=7、職業に sync-test が含まれることを確認");
  console.log(`5. 確認用 runId: ${runId}`);
  console.log(`6. 詳細 UI: ${baseUrl}/test/memory`);
}

async function testRepositoryRoundTrip(runId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    fail(
      "env",
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が .env.local にありません",
    );
  }

  pass("env", "Supabase 環境変数を確認");

  const payload = createMemorySyncTestPayload(runId);

  const saved = await upsertMemoryToSupabase(payload);
  pass("save", `Supabase へ保存 (${formatMemorySummary(saved)})`);

  const saveFailures = assertMemorySyncPayload({ runId, memory: saved });
  if (saveFailures.length > 0) {
    fail("save-assert", saveFailures.join("; "));
  }
  pass("save-assert", "保存直後の conversationCount / chatHistory / profile を確認");

  const loaded = await fetchMemoryFromSupabase();
  if (!loaded.exists) {
    fail("load", "Supabase 行が存在しません");
  }

  pass("load", `Supabase から読込 (${formatMemorySummary(loaded.memory)})`);

  const loadFailures = assertMemorySyncPayload({ runId, memory: loaded.memory });
  if (loadFailures.length > 0) {
    fail("load-assert", loadFailures.join("; "));
  }
  pass("load-assert", "読込結果が保存内容と一致");

  if (loaded.memory.conversationCount !== 7) {
    fail(
      "conversation-count",
      `expected 7, got ${loaded.memory.conversationCount}`,
    );
  }
  pass("conversation-count", "会話回数 7 を確認");

  const reloaded = await fetchMemoryFromSupabase();
  const reloadFailures = assertMemorySyncPayload({
    runId,
    memory: reloaded.memory,
  });
  if (reloadFailures.length > 0) {
    fail("reload", reloadFailures.join("; "));
  }
  pass("reload", "再取得でも同じデータを保持");
}

async function testApiRoundTrip(runId: string, baseUrl: string): Promise<void> {
  const payload = createMemorySyncTestPayload(`${runId}-api`);

  const putResponse = await fetch(`${baseUrl}/api/memory`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memory: payload }),
  });

  if (!putResponse.ok) {
    const body = await putResponse.text();
    fail("api-save", `${putResponse.status} ${body}`);
  }

  pass("api-save", "PUT /api/memory 成功");

  const getResponse = await fetch(`${baseUrl}/api/memory`, {
    cache: "no-store",
  });

  if (!getResponse.ok) {
    const body = await getResponse.text();
    fail("api-load", `${getResponse.status} ${body}`);
  }

  const data = (await getResponse.json()) as {
    exists?: boolean;
    memory?: unknown;
  };

  if (!data.exists || !data.memory) {
    fail("api-load", "GET /api/memory が空レスポンス");
  }

  const failures = assertMemorySyncPayload({
    runId: `${runId}-api`,
    memory: data.memory as ReturnType<typeof createMemorySyncTestPayload>,
  });

  if (failures.length > 0) {
    fail("api-load-assert", failures.join("; "));
  }

  pass("api-load", "GET /api/memory で API 経由読込を確認");
}

async function main(): Promise<void> {
  const runId = `${MEMORY_SYNC_TEST_MARKER}-${Date.now()}`;
  const baseUrl = process.env.MEMORY_TEST_BASE_URL ?? "http://localhost:3000";

  console.log(`Din AI memory sync smoke test (${runId})`);
  console.log("");

  await testRepositoryRoundTrip(runId);

  if (process.env.MEMORY_TEST_API === "1") {
    try {
      await testApiRoundTrip(runId, baseUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "API test failed unexpectedly";
      fail("api", message);
    }
  } else {
    console.log("");
    console.log(
      "ℹ API 経由テストはスキップ (MEMORY_TEST_API=1 で有効化。dev サーバー起動が必要)",
    );
  }

  printSummary();
  printCrossDeviceSteps(runId, baseUrl);

  console.log("");
  console.log("All automated checks passed.");
  console.log(
    "テストデータは Supabase に残ります。アプリ起動時にそのまま表示されます。",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

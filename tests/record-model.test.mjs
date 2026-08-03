import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
const model = await server.ssrLoadModule("/src/record-model.ts");
const sync = await server.ssrLoadModule("/src/github-sync.ts");
await server.close();

test("in-site form serializes fields in exporter-compatible Issue Form format", () => {
  const values = model.defaultValues("leetcode");
  Object.assign(values, { problem_title: "146. LRU Cache", difficulty: "medium", topics: "哈希表, 双向链表", mastery: "3" });
  const payload = model.buildIssuePayload("leetcode", values);

  assert.equal(payload.title, "[LC] 146. LRU Cache");
  assert.deepEqual(payload.labels, ["type:leetcode"]);
  assert.match(payload.body, /### 题目名称 \/ problem_title\n\n146\. LRU Cache/);
  assert.match(payload.body, /### 难度 \/ difficulty\n\nmedium/);
  assert.match(payload.body, /### 标签 \/ topics\n\n哈希表, 双向链表/);
});

test("API response becomes an immediately displayable record", () => {
  const values = model.defaultValues("goals");
  Object.assign(values, { goal_title: "本月完成十篇论文", target_value: "10", current_value: "2", metric: "篇" });
  const record = model.recordFromIssue("goals", values, { number: 42, html_url: "https://example.invalid/42", state: "open", created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:01Z" });

  assert.equal(record.id, 42);
  assert.equal(record.title, "本月完成十篇论文");
  assert.equal(record.currentValue, 2);
  assert.equal(record.targetValue, 10);
  assert.equal(record.pending, true);
});

test("pending records survive refresh until deployed data catches up", () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
  globalThis.sessionStorage = globalThis.localStorage;

  const values = model.defaultValues("goals");
  Object.assign(values, { goal_title: "即时目标", target_value: "5", current_value: "1" });
  const pending = model.recordFromIssue("goals", values, { number: 88, html_url: "https://example.invalid/88", state: "open", created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:02Z" });
  sync.rememberPendingRecord(pending);

  const empty = { config: { modules: { leetcode: true, papers: true, jobs: true, goals: true } }, leetcode: [], papers: [], jobs: [], goals: [], generatedAt: "2026-08-03T00:00:00Z" };
  const refreshed = sync.mergePendingRecords(empty);
  assert.equal(refreshed.goals[0].title, "即时目标");
  assert.equal(refreshed.goals[0].pending, true);

  const deployedRecord = { ...pending };
  delete deployedRecord.pending;
  const caughtUp = sync.mergePendingRecords({ ...empty, goals: [deployedRecord], generatedAt: "2026-08-03T00:01:00Z" });
  assert.equal(caughtUp.goals.length, 1);
  assert.equal(caughtUp.goals[0].pending, undefined);
  assert.equal(JSON.parse(memory.get("growthboard:pending-records")).length, 0);

  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});

function apiResponse(value) {
  return { ok: true, status: 200, json: async () => value };
}

test("only the repository owner token can connect", async () => {
  globalThis.fetch = async (url) => String(url).endsWith("/user")
    ? apiResponse({ login: "visitor" })
    : apiResponse({ full_name: "wei1305/growth-board", owner: { login: "wei1305" } });

  await assert.rejects(
    sync.validateToken("wei1305/growth-board", "visitor-token"),
    /只有仓库所有者 wei1305 可以连接并编辑记录/,
  );
  delete globalThis.fetch;
});

test("record mutations recheck the repository owner", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || "GET" });
    return apiResponse({ login: "visitor" });
  };

  await assert.rejects(
    sync.createRecord("wei1305/growth-board", "visitor-token", "goals", model.defaultValues("goals")),
    /当前仓库只允许仓库所有者 wei1305 编辑记录/,
  );
  assert.deepEqual(calls, [{ url: "https://api.github.com/user", method: "GET" }]);
  delete globalThis.fetch;
});

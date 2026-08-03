import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../config/site.json", import.meta.url), "utf8"));
const modules = ["leetcode", "papers", "jobs", "goals"];

test("site configuration contains every supported module switch", () => {
  assert.deepEqual(Object.keys(config.modules).sort(), modules.sort());
  for (const key of modules) assert.equal(typeof config.modules[key], "boolean");
});

test("repository uses owner/name format", () => {
  assert.match(config.repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
});

test("sample data envelopes are valid", async () => {
  for (const key of modules) {
    const payload = JSON.parse(await readFile(new URL(`../public/data/${key}.json`, import.meta.url), "utf8"));
    assert.ok(Array.isArray(payload.records));
    assert.equal(payload.repository, config.repository);
    for (const record of payload.records) assert.equal(record.type, key);
  }
});

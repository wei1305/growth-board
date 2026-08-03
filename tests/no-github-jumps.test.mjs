import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const composer = await readFile(new URL("../src/RecordComposer.tsx", import.meta.url), "utf8");

test("record management does not navigate to GitHub issue pages", () => {
  assert.doesNotMatch(app, /issues\/new/);
  assert.doesNotMatch(app, /href=\{record\.issueUrl\}/);
  assert.doesNotMatch(app, /edit\/main\/config/);
});

test("in-site composer supports create, update, archive and delete", () => {
  assert.match(composer, /createRecord/);
  assert.match(composer, /updateRecord/);
  assert.match(composer, /toggleArchive/);
  assert.match(composer, /deleteRecord/);
});

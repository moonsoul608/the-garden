/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const receiptsPath = path.join(projectRoot, "lib/local-note-receipts.ts");

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

function installWindow() {
  const storage = new Map();
  const events = [];

  global.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    dispatchEvent: (event) => events.push(event.type),
  };

  return { storage, events };
}

test.afterEach(() => {
  delete global.window;
});

test("local note receipts store only sent timestamp and short excerpt", () => {
  const { events } = installWindow();
  delete require.cache[receiptsPath];

  const {
    LOCAL_NOTE_RECEIPTS_CHANGED_EVENT,
    LOCAL_NOTE_RECEIPT_EXCERPT_LENGTH,
    readLocalNoteReceipts,
    saveLocalNoteReceipt,
  } = require(receiptsPath);

  assert.equal(
    saveLocalNoteReceipt(`  Hello\u0000 garden.\n\n${"x".repeat(200)}  `),
    true,
  );

  const receipts = readLocalNoteReceipts();
  assert.equal(receipts.length, 1);
  assert.match(receipts[0].sentAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof receipts[0].excerpt, "string");
  assert.ok(receipts[0].excerpt.length <= LOCAL_NOTE_RECEIPT_EXCERPT_LENGTH);
  assert.equal(JSON.stringify(receipts).includes("id"), false);
  assert.deepEqual(events, [LOCAL_NOTE_RECEIPTS_CHANGED_EVENT]);
});

test("local note receipts ignore invalid storage and remain bounded", () => {
  const { storage } = installWindow();
  delete require.cache[receiptsPath];

  const {
    LOCAL_NOTE_RECEIPTS_LIMIT,
    LOCAL_NOTE_RECEIPTS_STORAGE_KEY,
    readLocalNoteReceipts,
    saveLocalNoteReceipt,
  } = require(receiptsPath);

  storage.set(
    LOCAL_NOTE_RECEIPTS_STORAGE_KEY,
    JSON.stringify([
      { sentAt: "not-a-date", excerpt: "bad" },
      { sentAt: "2026-01-01T00:00:00.000Z", excerpt: "valid" },
      { sentAt: "2026-01-02T00:00:00.000Z", databaseId: "secret" },
    ]),
  );

  assert.deepEqual(readLocalNoteReceipts(), [
    { sentAt: "2026-01-02T00:00:00.000Z" },
    { sentAt: "2026-01-01T00:00:00.000Z", excerpt: "valid" },
  ]);

  for (let index = 0; index < LOCAL_NOTE_RECEIPTS_LIMIT + 3; index += 1) {
    assert.equal(saveLocalNoteReceipt(`Note ${index}`), true);
  }

  assert.equal(readLocalNoteReceipts().length, LOCAL_NOTE_RECEIPTS_LIMIT);
});

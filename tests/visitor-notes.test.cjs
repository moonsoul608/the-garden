/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveProjectAlias(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(projectRoot, request.slice(2))
    : request;
  return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
};

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

const {
  VISITOR_NOTE_MAX_MESSAGE_LENGTH,
  VISITOR_NOTE_MAX_NAME_LENGTH,
  prepareVisitorNoteInput,
} = require(path.join(projectRoot, "lib/visitor-notes.ts"));

test.after(() => {
  Module._resolveFilename = originalResolveFilename;
});

test("prepares sanitized visitor note input", () => {
  const result = prepareVisitorNoteInput({
    name: "  Xianhong\t ",
    message: "  Hello\u0000   garden \r\n\r\n\r\n thank you.  ",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.note, {
    name: "Xianhong",
    message: "Hello garden\n\nthank you.",
  });
});

test("validates required message and length limits", () => {
  assert.equal(prepareVisitorNoteInput({ message: " " }).ok, false);
  assert.equal(
    prepareVisitorNoteInput({ message: "x".repeat(VISITOR_NOTE_MAX_MESSAGE_LENGTH + 1) }).ok,
    false,
  );
  assert.equal(
    prepareVisitorNoteInput({
      name: "x".repeat(VISITOR_NOTE_MAX_NAME_LENGTH + 1),
      message: "A note",
    }).ok,
    false,
  );
});

test("limits link-heavy submissions", () => {
  const result = prepareVisitorNoteInput({
    message: "https://a.test https://b.test https://c.test https://d.test",
  });

  assert.equal(result.ok, false);
});

test("visitor note migration keeps notes private while enabling insert", () => {
  const migration = fs.readFileSync(
    path.join(
      projectRoot,
      "supabase/migrations/20260728160000_phase_10a_visitor_note_public_submission.sql",
    ),
    "utf8",
  );

  assert.match(migration, /grant insert \(name, message\) on table public\.visitor_notes to anon, authenticated/i);
  assert.match(migration, /for insert/i);
  assert.doesNotMatch(migration, /grant select[^;]+visitor_notes[^;]+anon/i);
});


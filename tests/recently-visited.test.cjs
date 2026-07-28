/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const recentlyVisitedPath = path.join(projectRoot, "lib/recently-visited.ts");

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

test("recently visited paths are browser-local, deduped, and newest first", () => {
  const { storage, events } = installWindow();
  delete require.cache[recentlyVisitedPath];

  const {
    RECENTLY_VISITED_CHANGED_EVENT,
    RECENTLY_VISITED_LIMIT,
    RECENTLY_VISITED_STORAGE_KEY,
    readRecentlyVisitedPaths,
    recordRecentlyVisitedPath,
  } = require(recentlyVisitedPath);

  storage.set(
    RECENTLY_VISITED_STORAGE_KEY,
    JSON.stringify([
      { route: "/garden/old-seed", visitedAt: "2020-01-01T00:00:00.000Z" },
    ]),
  );

  assert.equal(recordRecentlyVisitedPath("/garden/old-seed"), true);
  assert.equal(recordRecentlyVisitedPath("/forest/new-question"), true);

  const paths = readRecentlyVisitedPaths();
  assert.equal(paths.length, 2);
  assert.equal(paths[0].route, "/forest/new-question");
  assert.equal(paths[1].route, "/garden/old-seed");
  assert.notEqual(paths[1].visitedAt, "2020-01-01T00:00:00.000Z");
  assert.deepEqual(
    events,
    [RECENTLY_VISITED_CHANGED_EVENT, RECENTLY_VISITED_CHANGED_EVENT],
  );

  for (let index = 0; index < RECENTLY_VISITED_LIMIT + 4; index += 1) {
    assert.equal(recordRecentlyVisitedPath(`/garden/path-${index}`), true);
  }

  const bounded = readRecentlyVisitedPaths();
  assert.equal(bounded.length, RECENTLY_VISITED_LIMIT);
  assert.equal(new Set(bounded.map((path) => path.route)).size, bounded.length);
});

test("recently visited paths ignore unavailable storage shapes", () => {
  const { storage } = installWindow();
  delete require.cache[recentlyVisitedPath];

  const {
    RECENTLY_VISITED_STORAGE_KEY,
    readRecentlyVisitedPaths,
    recordRecentlyVisitedPath,
  } = require(recentlyVisitedPath);

  storage.set(
    RECENTLY_VISITED_STORAGE_KEY,
    JSON.stringify([
      { route: "not-a-route", visitedAt: "2026-01-01T00:00:00.000Z" },
      { route: "/garden/no-date", visitedAt: "not-a-date" },
      { route: "/garden/valid", visitedAt: "2026-01-01T00:00:00.000Z" },
    ]),
  );

  assert.deepEqual(readRecentlyVisitedPaths(), [
    { route: "/garden/valid", visitedAt: "2026-01-01T00:00:00.000Z" },
  ]);
  assert.equal(recordRecentlyVisitedPath("not-a-route"), false);
});

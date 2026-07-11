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

const { POST } = require(path.join(projectRoot, "app/api/seed-gardener/route.ts"));
const originalFetch = global.fetch;
const originalApiKey = process.env.DEEPSEEK_API_KEY;

const validSeed = {
  seedName: "A small seed",
  coreQuestion: "What should grow first?",
  suggestedRegion: "Garden",
  growthStage: "Seed",
  pathsToExplore: ["Path one", "Path two", "Path three"],
  firstStep: "Write one question today.",
};

function makeRequest(body) {
  return new Request("http://localhost/api/seed-gardener", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function mockProviderContent(content, status = 200) {
  global.fetch = async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer test-key");

    const requestBody = JSON.parse(init.body);
    assert.equal(requestBody.model, "deepseek-v4-flash");
    assert.deepEqual(requestBody.thinking, { type: "disabled" });
    assert.deepEqual(requestBody.response_format, { type: "json_object" });
    assert.equal(requestBody.stream, false);
    assert.equal(requestBody.max_tokens, 700);
    assert.equal(requestBody.messages[0].role, "system");
    assert.match(requestBody.messages[0].content, /json/);
    assert.equal(requestBody.messages[1].role, "user");

    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  };
}

test.beforeEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  global.fetch = originalFetch;
});

test.after(() => {
  Module._resolveFilename = originalResolveFilename;
  global.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalApiKey;
});

test("returns 503 when DEEPSEEK_API_KEY is missing", async () => {
  const response = await POST(makeRequest(JSON.stringify({ idea: "A question" })));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "The Seed Gardener is not configured right now.",
  });
});

test("rejects invalid JSON, empty input, and overlong input", async () => {
  const invalidJson = await POST(makeRequest("{"));
  assert.equal(invalidJson.status, 400);

  const empty = await POST(makeRequest(JSON.stringify({ idea: "   " })));
  assert.equal(empty.status, 400);

  const overlong = await POST(makeRequest(JSON.stringify({ idea: "x".repeat(1001) })));
  assert.equal(overlong.status, 400);
});

test("accepts a valid DeepSeek JSON response and sends the required request", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  mockProviderContent(JSON.stringify(validSeed));

  const response = await POST(makeRequest(JSON.stringify({ idea: "A question" })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, seed: validSeed });
});

for (const [name, content] of [
  ["empty content", ""],
  ["malformed JSON", "not-json"],
  ["invalid suggestedRegion", JSON.stringify({ ...validSeed, suggestedRegion: "Lake" })],
  ["invalid growthStage", JSON.stringify({ ...validSeed, growthStage: "Growing" })],
  ["too few paths", JSON.stringify({ ...validSeed, pathsToExplore: ["One", "Two"] })],
  ["too many paths", JSON.stringify({ ...validSeed, pathsToExplore: ["One", "Two", "Three", "Four"] })],
]) {
  test(`returns 502 for ${name}`, async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    mockProviderContent(content);

    const response = await POST(makeRequest(JSON.stringify({ idea: "A question" })));
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "The Seed Gardener returned an invalid result.");
  });
}

for (const [providerStatus, expectedStatus, expectedError] of [
  [401, 502, "The Seed Gardener provider configuration is unavailable."],
  [403, 502, "The Seed Gardener provider configuration is unavailable."],
  [402, 503, "The Seed Gardener billing or balance is unavailable."],
  [429, 503, "The Seed Gardener is temporarily rate limited."],
  [500, 503, "The Seed Gardener provider is temporarily unavailable."],
]) {
  test(`maps provider ${providerStatus} to a safe error`, async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    mockProviderContent("provider detail that must not escape", providerStatus);

    const response = await POST(makeRequest(JSON.stringify({ idea: "A question" })));
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await response.json(), { ok: false, error: expectedError });
  });
}

test("returns a safe timeout error", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  global.fetch = async () => {
    throw new DOMException("provider details", "AbortError");
  };

  const response = await POST(makeRequest(JSON.stringify({ idea: "A question" })));
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "The Seed Gardener request timed out.",
  });
});

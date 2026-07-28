/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const baseUrl = process.env.BASE_URL || "http://localhost:3001";

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
  return { response, html: await response.text() };
}

(async () => {
  const home = await get("/");
  assert.equal(home.response.status, 200);
  assert.match(home.html, /<title>Home<\/title>/);
  assert.match(home.html, /<h1[^>]*>Welcome to The Garden\.<\/h1>/);

  const index = await get("/garden-index");
  assert.equal(index.response.status, 200);
  assert.match(index.html, /<h1[^>]*>Garden Index<\/h1>/);
  assert.match(index.html, /href="\/garden-index"[^>]*>Garden Index<\/a>/);
  assert.match(index.html, /href="\/your-paths"[^>]*>Your Paths<\/a>/);
  assert.match(index.html, /href="\/"[^>]*>Back to the entrance<\/a>/);
  assert.doesNotMatch(index.html, /<h2[^>]*id="saved-paths-title"[^>]*>Saved Paths<\/h2>/);
  assert.doesNotMatch(index.html, /href="\/index(?:[?#"])/);
  assert.doesNotMatch(index.html, /href="\/search(?:[?#"])/);

  const yourPaths = await get("/your-paths");
  assert.equal(yourPaths.response.status, 200);
  assert.match(yourPaths.html, /<h1[^>]*>Your Paths<\/h1>/);
  assert.match(yourPaths.html, /<h2[^>]*id="saved-paths-title"[^>]*>Saved Paths<\/h2>/);

  const search = await get("/search?q=garden&region=Lake");
  assert.equal(search.response.status, 307);
  assert.match(search.response.headers.get("location") ?? "", /\/garden-index\?q=garden&region=Lake$/);

  const contentPaths = [...index.html.matchAll(/href="(\/(?:garden|forest|lake|ruins)\/[^"?#]+)"/g)]
    .map((match) => match[1])
    .filter((pathname, position, paths) => paths.indexOf(pathname) === position);

  assert.equal(contentPaths.length, 6, `Expected 6 initially visible content links, found ${contentPaths.length}`);

  const results = await Promise.all(contentPaths.map(async (pathname) => {
    const response = await fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
    return { pathname, status: response.status };
  }));
  assert.deepEqual(results.filter(({ status }) => status !== 200), []);

  console.log("PASS / returns Home (200)");
  console.log("PASS /garden-index returns Garden Index (200)");
  console.log("PASS /your-paths returns Your Paths with Saved Paths (200)");
  console.log("PASS /search redirects to Garden Index with query parameters");
  console.log("PASS Garden Index and Back to the entrance use distinct canonical routes");
  console.log("PASS initially visible Garden Index content links return 200");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

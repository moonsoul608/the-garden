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
  assert.match(index.html, /href="\/"[^>]*>Back to the entrance<\/a>/);
  assert.doesNotMatch(index.html, /href="\/index(?:[?#"])/);

  const contentPaths = [...index.html.matchAll(/href="(\/(?:garden|forest|lake|ruins)\/[^"?#]+)"/g)]
    .map((match) => match[1])
    .filter((pathname, position, paths) => paths.indexOf(pathname) === position);

  assert.equal(contentPaths.length, 19, `Expected 19 unique content links, found ${contentPaths.length}`);

  const results = await Promise.all(contentPaths.map(async (pathname) => {
    const response = await fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
    return { pathname, status: response.status };
  }));
  assert.deepEqual(results.filter(({ status }) => status !== 200), []);

  console.log("PASS / returns Home (200)");
  console.log("PASS /garden-index returns Garden Index (200)");
  console.log("PASS Garden Index and Back to the entrance use distinct canonical routes");
  console.log("PASS all 19 Garden Index content links return 200");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

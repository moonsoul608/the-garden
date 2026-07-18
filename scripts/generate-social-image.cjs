/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const source = path.join(projectRoot, "public", "opengraph-image.svg");
const output = path.join(projectRoot, "public", "opengraph-image.png");

sharp(source)
  .png()
  .toFile(output)
  .then(({ width, height }) => {
    console.log(`Generated ${width}x${height} social preview.`);
  });

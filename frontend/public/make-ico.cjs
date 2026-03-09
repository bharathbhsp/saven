#!/usr/bin/env node
// Creates a minimal 16x16 ICO (teal square) and writes favicon.ico
const fs = require("fs");
const path = require("path");

const W = 16;
const H = 16;
// Teal #0d9488 (tailwind teal-600): B=0x88, G=0x94, R=0x0d, A=0xff
const R = 0x0d, G = 0x94, B = 0x88, A = 0xff;

function createICO() {
  const pixels = [];
  for (let y = H - 1; y >= 0; y--) {
    for (let x = 0; x < W; x++) {
      pixels.push(B, G, R, A);
    }
  }
  const imageData = Buffer.from(pixels);
  const bmpHeaderSize = 40;
  const imageSize = bmpHeaderSize + imageData.length;
  const fileHeader = Buffer.alloc(6);
  fileHeader.writeUInt16LE(0, 0);
  fileHeader.writeUInt16LE(1, 2);
  fileHeader.writeUInt16LE(1, 4);
  const dirEntry = Buffer.alloc(16);
  dirEntry[0] = W;
  dirEntry[1] = H;
  dirEntry[2] = 0;
  dirEntry[3] = 0;
  dirEntry.writeUInt16LE(1, 4);
  dirEntry.writeUInt16LE(32, 6);
  dirEntry.writeUInt32LE(imageSize, 8);
  dirEntry.writeUInt32LE(22, 12);
  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0);
  dibHeader.writeInt32LE(W, 4);
  dibHeader.writeInt32LE(H * 2, 8);
  dibHeader.writeUInt16LE(1, 12);
  dibHeader.writeUInt16LE(32, 14);
  dibHeader.writeUInt32LE(0, 16);
  dibHeader.writeUInt32LE(imageData.length, 20);
  return Buffer.concat([fileHeader, dirEntry, dibHeader, imageData]);
}

const ico = createICO();
const out = path.join(__dirname, "favicon.ico");
fs.writeFileSync(out, ico);
console.log("Wrote", out);

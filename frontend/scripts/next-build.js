#!/usr/bin/env node

// Wraps Next.js build so accidental CLI arguments (e.g. from Vercel) are ignored.
const { spawnSync } = require('child_process');
const { rmSync } = require('fs');
const { join } = require('path');

const distCandidates = ['.next', 'dist'];

for (const folder of distCandidates) {
  try {
    rmSync(join(process.cwd(), folder), { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to clean ${folder}:`, error);
  }
}

const result =
  process.platform === 'win32'
    ? spawnSync('cmd', ['/c', 'next', 'build'], { stdio: 'inherit', env: process.env })
    : spawnSync('next', ['build'], { stdio: 'inherit', env: process.env });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);

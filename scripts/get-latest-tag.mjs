#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const upstream = process.argv[2] ?? "https://github.com/vrtmrz/obsidian-livesync.git";
const output = execFileSync("git", ["ls-remote", "--tags", "--refs", upstream], {
    encoding: "utf8",
}).trim();

const tags = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^.*refs\/tags\//, ""))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

if (tags.length === 0) {
    console.error(`No tags found for ${upstream}`);
    process.exit(1);
}

process.stdout.write(`${tags.at(-1)}\n`);

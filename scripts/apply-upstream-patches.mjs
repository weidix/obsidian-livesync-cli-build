#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function getArg(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

const upstreamRoot = getArg("--upstream");

if (!upstreamRoot) {
    console.error("Usage: apply-upstream-patches.mjs --upstream <dir>");
    process.exit(1);
}

const p2pCommandPath = path.join(upstreamRoot, "src", "apps", "cli", "commands", "p2p.ts");

if (existsSync(p2pCommandPath)) {
    const before = readFileSync(p2pCommandPath, "utf8");
    const brokenImport =
        'import { addP2PEventHandlers } from "@lib/replication/trystero/P2PReplicatorCore";';
    const fixedImport =
        'import { addP2PEventHandlers } from "@lib/replication/trystero/addP2PEventHandlers";';

    if (before.includes(brokenImport)) {
        const after = before.replace(brokenImport, fixedImport);
        writeFileSync(p2pCommandPath, after, "utf8");
        console.log("Patched upstream CLI P2P import for compatibility");
    } else {
        console.log("No upstream compatibility patch needed");
    }
}

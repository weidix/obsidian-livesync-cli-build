import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { pruneRuntimePackage } from "../scripts/create-runtime-package.mjs";

function writeFile(filePath, contents = "") {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, "utf8");
}

test("pruneRuntimePackage removes package noise while keeping required macOS arm64 native files", async () => {
    const packageRoot = await os.tmpdir();
    const fixtureRoot = path.join(packageRoot, `runtime-package-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    writeFile(path.join(fixtureRoot, "package-lock.json"), "{}\n");
    writeFile(path.join(fixtureRoot, "node_modules", "pkg", "README.md"), "docs");
    writeFile(path.join(fixtureRoot, "node_modules", "pkg", "tests", "sample.test.js"), "test");
    writeFile(path.join(fixtureRoot, "node_modules", "pkg", "docs", "guide.txt"), "guide");
    writeFile(path.join(fixtureRoot, "node_modules", "pkg", "dist", "index.js.map"), "{}");

    writeFile(
        path.join(fixtureRoot, "node_modules", "node-datachannel", "build", "Release", "node_datachannel.node"),
        "native"
    );
    writeFile(
        path.join(fixtureRoot, "node_modules", "node-datachannel", "build", "Release", "obj.target", "temp.o"),
        "object"
    );

    writeFile(
        path.join(fixtureRoot, "node_modules", "leveldown", "prebuilds", "darwin-x64+arm64", "node.napi.node"),
        "darwin"
    );
    writeFile(
        path.join(fixtureRoot, "node_modules", "leveldown", "prebuilds", "linux-x64", "node.napi.glibc.node"),
        "linux"
    );

    writeFile(
        path.join(fixtureRoot, "node_modules", "level", "node_modules", "leveldown", "build", "Release", "leveldown.node"),
        "native"
    );
    writeFile(
        path.join(fixtureRoot, "node_modules", "level", "node_modules", "leveldown", "build", "Release", "leveldb.a"),
        "archive"
    );
    writeFile(
        path.join(fixtureRoot, "node_modules", "level", "node_modules", "leveldown", "prebuilds", "linux-x64", "node.napi.glibc.node"),
        "linux"
    );

    pruneRuntimePackage(fixtureRoot, "macos-arm64");

    assert.equal(existsSync(path.join(fixtureRoot, "package-lock.json")), false);
    assert.equal(existsSync(path.join(fixtureRoot, "node_modules", "pkg", "README.md")), false);
    assert.equal(existsSync(path.join(fixtureRoot, "node_modules", "pkg", "tests")), false);
    assert.equal(existsSync(path.join(fixtureRoot, "node_modules", "pkg", "docs")), false);
    assert.equal(existsSync(path.join(fixtureRoot, "node_modules", "pkg", "dist", "index.js.map")), false);

    assert.equal(
        existsSync(
            path.join(fixtureRoot, "node_modules", "node-datachannel", "build", "Release", "node_datachannel.node")
        ),
        true
    );
    assert.equal(
        existsSync(
            path.join(fixtureRoot, "node_modules", "node-datachannel", "build", "Release", "obj.target", "temp.o")
        ),
        false
    );

    assert.equal(
        existsSync(path.join(fixtureRoot, "node_modules", "leveldown", "prebuilds", "darwin-x64+arm64", "node.napi.node")),
        true
    );
    assert.equal(
        existsSync(path.join(fixtureRoot, "node_modules", "leveldown", "prebuilds", "linux-x64", "node.napi.glibc.node")),
        false
    );

    assert.equal(
        existsSync(
            path.join(
                fixtureRoot,
                "node_modules",
                "level",
                "node_modules",
                "leveldown",
                "build",
                "Release",
                "leveldown.node"
            )
        ),
        true
    );
    assert.equal(
        existsSync(
            path.join(
                fixtureRoot,
                "node_modules",
                "level",
                "node_modules",
                "leveldown",
                "build",
                "Release",
                "leveldb.a"
            )
        ),
        false
    );
    assert.equal(
        existsSync(
            path.join(
                fixtureRoot,
                "node_modules",
                "level",
                "node_modules",
                "leveldown",
                "prebuilds",
                "linux-x64",
                "node.napi.glibc.node"
            )
        ),
        false
    );
});

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.resolve("scripts/install-livesync-cli.sh");

function runScript(command, extraEnv = {}) {
    return execFileSync("sh", [scriptPath, command], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
            ...process.env,
            HOME: "/tmp/test-home",
            LIVESYNC_CLI_VERSION: "0.25.54",
            LIVESYNC_CLI_DRY_RUN: "1",
            ...extraEnv,
        },
    });
}

test("install dry-run prints the expected release asset URL and install paths", () => {
    const output = runScript("install");

    assert.match(output, /ACTION=install/);
    assert.match(output, /VERSION=0\.25\.54/);
    assert.match(output, /ASSET_NAME=obsidian-livesync-cli-0\.25\.54-macos-arm64\.tar\.gz/);
    assert.match(output, /DOWNLOAD_URL=https:\/\/github\.com\/weidix\/obsidian-livesync-cli-build\/releases\/download\/0\.25\.54\/obsidian-livesync-cli-0\.25\.54-macos-arm64\.tar\.gz/);
    assert.match(output, /INSTALL_ROOT=\/tmp\/test-home\/\.local\/share\/obsidian-livesync-cli/);
    assert.match(output, /BIN_PATH=\/tmp\/test-home\/\.local\/bin\/livesync-cli/);
});

test("update dry-run uses the same release lookup and target paths", () => {
    const output = runScript("update");

    assert.match(output, /ACTION=update/);
    assert.match(output, /VERSION=0\.25\.54/);
    assert.match(output, /DOWNLOAD_URL=https:\/\/github\.com\/weidix\/obsidian-livesync-cli-build\/releases\/download\/0\.25\.54\/obsidian-livesync-cli-0\.25\.54-macos-arm64\.tar\.gz/);
});

test("uninstall dry-run reports the files it would remove", () => {
    const output = runScript("uninstall");

    assert.match(output, /ACTION=uninstall/);
    assert.match(output, /INSTALL_ROOT=\/tmp\/test-home\/\.local\/share\/obsidian-livesync-cli/);
    assert.match(output, /BIN_PATH=\/tmp\/test-home\/\.local\/bin\/livesync-cli/);
});

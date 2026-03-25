#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, cpSync, chmodSync, existsSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

function getArg(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(cmd, args, options = {}) {
    const result = spawnSync(cmd, args, {
        stdio: "inherit",
        ...options,
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function removePath(target) {
    if (!existsSync(target)) return;
    rmSync(target, { recursive: true, force: true });
}

function removeDirectoryEntries(directory, keepNames = new Set()) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory)) {
        if (keepNames.has(entry)) continue;
        removePath(path.join(directory, entry));
    }
}

function packageNameForImport(specifier) {
    if (specifier.startsWith("@")) {
        const parts = specifier.split("/");
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
    }
    return specifier.split("/")[0];
}

function resolveDependencyVersion(upstreamRoot, upstreamPackage, name) {
    const fromPackageJson = upstreamPackage.dependencies?.[name] ?? upstreamPackage.devDependencies?.[name];
    if (fromPackageJson) {
        return fromPackageJson;
    }

    const installedPackageJsonPath = path.join(upstreamRoot, "node_modules", name, "package.json");
    if (existsSync(installedPackageJsonPath)) {
        const installed = JSON.parse(readFileSync(installedPackageJsonPath, "utf8"));
        return `^${installed.version}`;
    }

    return undefined;
}

function platformKeepDirectories(platform) {
    if (platform === "macos-arm64") {
        return new Set(["darwin-x64+arm64"]);
    }
    return new Set();
}

export function pruneRuntimePackage(packageRoot, platform) {
    const nodeModulesRoot = path.join(packageRoot, "node_modules");

    removePath(path.join(packageRoot, "package-lock.json"));

    const removableDirectoryNames = new Set(["test", "tests", "example", "examples", "docs", "doc"]);
    const removableFileNames = new Set(["binding.gyp"]);
    const removableExtensions = new Set([".md", ".markdown", ".map", ".c", ".cc", ".h", ".mk"]);

    function pruneDirectory(directory) {
        if (!existsSync(directory)) return;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (removableDirectoryNames.has(entry.name)) {
                    removePath(entryPath);
                    continue;
                }
                pruneDirectory(entryPath);
                continue;
            }
            if (removableFileNames.has(entry.name) || removableExtensions.has(path.extname(entry.name))) {
                removePath(entryPath);
            }
        }
    }

    pruneDirectory(nodeModulesRoot);

    const nodeDataChannelBuild = path.join(nodeModulesRoot, "node-datachannel", "build");
    removeDirectoryEntries(nodeDataChannelBuild, new Set(["Release"]));
    removeDirectoryEntries(path.join(nodeDataChannelBuild, "Release"), new Set(["node_datachannel.node"]));

    const topLevelLeveldownPrebuilds = path.join(nodeModulesRoot, "leveldown", "prebuilds");
    removeDirectoryEntries(topLevelLeveldownPrebuilds, platformKeepDirectories(platform));

    const nestedLeveldownRoot = path.join(nodeModulesRoot, "level", "node_modules", "leveldown");
    removePath(path.join(nestedLeveldownRoot, "prebuilds"));
    removeDirectoryEntries(path.join(nestedLeveldownRoot, "build"), new Set(["Release"]));
    removeDirectoryEntries(path.join(nestedLeveldownRoot, "build", "Release"), new Set(["leveldown.node"]));
}

function main() {
    const upstreamRoot = getArg("--upstream");
    const tag = getArg("--tag");
    const platform = getArg("--platform") ?? "macos-arm64";
    const outDir = getArg("--out");

    if (!upstreamRoot || !tag || !outDir) {
        console.error("Usage: create-runtime-package.mjs --upstream <dir> --tag <tag> --out <dir> [--platform <name>]");
        process.exit(1);
    }

    const upstreamPackageJsonPath = path.join(upstreamRoot, "package.json");
    const upstreamPackage = JSON.parse(readFileSync(upstreamPackageJsonPath, "utf8"));

    const releaseName = `obsidian-livesync-cli-${tag}-${platform}`;
    const packageRoot = path.join(outDir, releaseName);
    const distSource = path.join(upstreamRoot, "src", "apps", "cli", "dist");

    if (existsSync(packageRoot)) {
        rmSync(packageRoot, { recursive: true, force: true });
    }

    mkdirSync(packageRoot, { recursive: true });
    mkdirSync(path.join(packageRoot, "bin"), { recursive: true });

    const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
    const runtimeDeps = new Set();

    for (const fileName of readdirSync(distSource)) {
        if (!fileName.endsWith(".cjs")) continue;
        const contents = readFileSync(path.join(distSource, fileName), "utf8");
        const matches = [...contents.matchAll(/require\(["']([^"']+)["']\)/g)].map((match) => match[1]);
        for (const match of matches) {
            if (match.startsWith(".")) continue;
            if (builtins.has(match)) continue;
            const packageName = packageNameForImport(match);
            if (builtins.has(packageName)) continue;
            runtimeDeps.add(packageName);
        }
    }

    const dependencies = Object.fromEntries(
        [...runtimeDeps]
            .sort((a, b) => a.localeCompare(b))
            .map((name) => {
                const version = resolveDependencyVersion(upstreamRoot, upstreamPackage, name);
                if (!version) {
                    console.warn(`Skipping unresolved runtime dependency: ${name}`);
                    return undefined;
                }
                return [name, version];
            })
            .filter(Boolean)
    );

    writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
            {
                name: "obsidian-livesync-cli-runtime",
                private: true,
                version: tag,
                type: "commonjs",
                engines: {
                    node: ">=22",
                },
                dependencies,
            },
            null,
            2
        ) + "\n",
        "utf8"
    );

    writeFileSync(
        path.join(packageRoot, "README.md"),
        [
            "# obsidian-livesync CLI Runtime Package",
            "",
            `Upstream tag: \`${tag}\``,
            `Platform: \`${platform}\``,
            "",
            "Node.js is not bundled.",
            "",
            "Requirement:",
            "",
            "- Node.js 22 or newer",
            "",
            "Usage:",
            "",
            "```bash",
            "./bin/livesync-cli --help",
            "```",
        ].join("\n") + "\n",
        "utf8"
    );

    writeFileSync(
        path.join(packageRoot, "BUILD-INFO.json"),
        JSON.stringify(
            {
                upstreamRepo: "https://github.com/vrtmrz/obsidian-livesync",
                upstreamTag: tag,
                platform,
                builtAt: new Date().toISOString(),
            },
            null,
            2
        ) + "\n",
        "utf8"
    );

    writeFileSync(
        path.join(packageRoot, "bin", "livesync-cli"),
        [
            "#!/usr/bin/env sh",
            "set -eu",
            'ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)',
            'exec node "$ROOT_DIR/dist/index.cjs" "$@"',
            "",
        ].join("\n"),
        "utf8"
    );
    chmodSync(path.join(packageRoot, "bin", "livesync-cli"), 0o755);

    writeFileSync(
        path.join(packageRoot, "bin", "livesync-cli.cmd"),
        [
            "@echo off",
            'set SCRIPT_DIR=%~dp0..',
            'node "%SCRIPT_DIR%\\dist\\index.cjs" %*',
            "",
        ].join("\r\n"),
        "utf8"
    );

    cpSync(distSource, path.join(packageRoot, "dist"), { recursive: true });
    cpSync(path.join(upstreamRoot, "LICENSE"), path.join(packageRoot, "LICENSE"));

    run("npm", ["install", "--omit=dev", "--no-fund", "--no-audit"], {
        cwd: packageRoot,
    });

    pruneRuntimePackage(packageRoot, platform);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main();
}

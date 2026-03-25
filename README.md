# obsidian-livesync-cli-build

Public build-wrapper repository for packaging the upstream `obsidian-livesync` CLI from the latest upstream tag.

## What this repository does

- Tracks the latest tag from [`vrtmrz/obsidian-livesync`](https://github.com/vrtmrz/obsidian-livesync)
- Builds the upstream CLI from `src/apps/cli`
- Produces a distributable artifact for `macos-arm64`
- Packages the CLI without bundling Node.js

## What the artifact contains

- `dist/` from the upstream CLI build
- Minimal runtime `node_modules/`
- `bin/livesync-cli` launcher scripts
- Upstream `LICENSE`
- `BUILD-INFO.json`

## What the artifact does not contain

- Node.js

You must install Node.js yourself before using the artifact.

## Runtime requirement

- Node.js 22 or newer

## How the workflow works

1. Resolve the latest upstream tag
2. Check out the upstream repository at that tag, including submodules
3. Install dependencies
4. Build the upstream CLI
5. Create a minimal runtime package
6. Upload a `tar.gz` artifact
7. Publish the same archive to a GitHub Release whose tag matches the upstream tag

## Compatibility patching

The wrapper may apply a minimal build-time compatibility patch when the latest upstream tag contains a known CLI build break.

At the moment, this wrapper fixes a bad import in `src/apps/cli/commands/p2p.ts` found in upstream `0.25.54`, replacing the broken import target with the actual exported helper module.

The goal is only to make the upstream CLI buildable as packaged upstream code, not to maintain a downstream feature fork.

## Using the downloaded artifact

After extracting the archive:

```bash
./bin/livesync-cli --help
```

Example:

```bash
./bin/livesync-cli "/path/to/vault" --settings "/path/to/data.json" sync
```

## Notes

- This repository is not a fork.
- The source of truth remains the upstream repository.
- The current workflow intentionally targets `macos-arm64` first so the produced artifact can be validated on Apple Silicon macOS without bundling Node.js.

#!/usr/bin/env sh
set -eu

REPOSITORY="${LIVESYNC_CLI_REPOSITORY:-weidix/obsidian-livesync-cli-build}"
PLATFORM="${LIVESYNC_CLI_PLATFORM:-macos-arm64}"
INSTALL_ROOT="${LIVESYNC_CLI_INSTALL_ROOT:-$HOME/.local/share/obsidian-livesync-cli}"
BIN_DIR="${LIVESYNC_CLI_BIN_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/livesync-cli"
DRY_RUN="${LIVESYNC_CLI_DRY_RUN:-0}"

write_wrapper() {
    mkdir -p "$BIN_DIR"
    cat >"$BIN_PATH" <<EOF
#!/usr/bin/env sh
set -eu
exec node "$INSTALL_ROOT/dist/index.cjs" "\$@"
EOF
    chmod +x "$BIN_PATH"
}

usage() {
    cat <<'EOF'
Usage: install-livesync-cli.sh <install|update|uninstall>

Environment overrides:
  LIVESYNC_CLI_VERSION       Install/update a specific release tag instead of the latest release
  LIVESYNC_CLI_PLATFORM      Override the release asset platform name (default: macos-arm64)
  LIVESYNC_CLI_INSTALL_ROOT  Override the installation root directory
  LIVESYNC_CLI_BIN_DIR       Override the bin directory that will contain livesync-cli
  LIVESYNC_CLI_REPOSITORY    Override the GitHub repository used for release downloads
  LIVESYNC_CLI_DRY_RUN=1     Print resolved paths and URLs without changing anything
EOF
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$1" >&2
        exit 1
    fi
}

resolve_latest_version() {
    if [ -n "${LIVESYNC_CLI_LATEST_RELEASE_JSON:-}" ]; then
        response="$LIVESYNC_CLI_LATEST_RELEASE_JSON"
    else
        require_command curl
        response="$(curl -fsSL "https://api.github.com/repos/$REPOSITORY/releases/latest")"
    fi
    version="$(printf '%s' "$response" | tr -d '\n' | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    if [ -z "$version" ]; then
        printf 'Failed to resolve the latest release tag for %s\n' "$REPOSITORY" >&2
        exit 1
    fi
    printf '%s\n' "$version"
}

resolve_version() {
    if [ -n "${LIVESYNC_CLI_VERSION:-}" ]; then
        printf '%s\n' "$LIVESYNC_CLI_VERSION"
        return
    fi
    resolve_latest_version
}

asset_name_for() {
    version="$1"
    printf 'obsidian-livesync-cli-%s-%s.tar.gz\n' "$version" "$PLATFORM"
}

download_url_for() {
    version="$1"
    asset_name="$(asset_name_for "$version")"
    printf 'https://github.com/%s/releases/download/%s/%s\n' "$REPOSITORY" "$version" "$asset_name"
}

print_plan() {
    action="$1"
    version="${2:-}"
    printf 'ACTION=%s\n' "$action"
    printf 'INSTALL_ROOT=%s\n' "$INSTALL_ROOT"
    printf 'BIN_PATH=%s\n' "$BIN_PATH"
    if [ -n "$version" ]; then
        printf 'VERSION=%s\n' "$version"
        printf 'ASSET_NAME=%s\n' "$(asset_name_for "$version")"
        printf 'DOWNLOAD_URL=%s\n' "$(download_url_for "$version")"
    fi
}

install_or_update() {
    action="$1"
    version="$(resolve_version)"

    if [ "$DRY_RUN" = "1" ]; then
        print_plan "$action" "$version"
        return
    fi

    require_command curl
    require_command tar
    require_command mktemp

    archive_name="$(asset_name_for "$version")"
    download_url="$(download_url_for "$version")"
    tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/obsidian-livesync-cli.XXXXXX")"
    cleanup_tmp() {
        rm -rf "$tmp_dir"
    }
    trap cleanup_tmp EXIT INT TERM

    archive_path="$tmp_dir/$archive_name"
    extract_root="$tmp_dir/extracted"
    extracted_package="$extract_root/obsidian-livesync-cli-$version-$PLATFORM"

    mkdir -p "$extract_root" "$BIN_DIR"

    printf 'Downloading %s\n' "$download_url"
    curl -fsSL "$download_url" -o "$archive_path"
    tar -xzf "$archive_path" -C "$extract_root"

    if [ ! -d "$extracted_package" ]; then
        printf 'Expected extracted package directory not found: %s\n' "$extracted_package" >&2
        exit 1
    fi

    rm -rf "$INSTALL_ROOT"
    mkdir -p "$(dirname "$INSTALL_ROOT")"
    mv "$extracted_package" "$INSTALL_ROOT"
    write_wrapper

    printf 'Installed %s to %s\n' "$version" "$INSTALL_ROOT"
    printf 'Command path: %s\n' "$BIN_PATH"
}

uninstall() {
    if [ "$DRY_RUN" = "1" ]; then
        print_plan "uninstall"
        return
    fi

    rm -f "$BIN_PATH"
    rm -rf "$INSTALL_ROOT"

    printf 'Removed %s\n' "$INSTALL_ROOT"
    printf 'Removed %s\n' "$BIN_PATH"
}

main() {
    action="${1:-}"
    case "$action" in
        install)
            install_or_update "install"
            ;;
        update)
            install_or_update "update"
            ;;
        uninstall)
            uninstall
            ;;
        ""|-h|--help|help)
            usage
            ;;
        *)
            printf 'Unknown action: %s\n' "$action" >&2
            usage >&2
            exit 1
            ;;
    esac
}

main "$@"

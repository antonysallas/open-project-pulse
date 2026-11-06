#!/bin/sh
# Open Project Pulse installer.
#
#   curl -LsSf https://raw.githubusercontent.com/antonysallas/open-project-pulse/main/install.sh | sh
#
# Installs for this user only; it needs no admin rights and installs no system
# packages. Run it again to update.
#
#   ~/.local/bin/pulse                       the command
#   ~/.local/share/open-project-pulse/app    the app (replaced on update)
#   ~/.local/share/open-project-pulse/node   its own Node.js, only if you have no Node 20+
#   ~/.local/share/open-project-pulse/data   your projects and reports
#
# A first install, into an empty data folder, adds a made-up sample project to
# look at (`pulse sample --remove` takes it away). After that, this script never
# touches your data.
#
# Optional settings, as environment variables:
#   PULSE_VERSION         a release tag such as v0.1.0 (default: the latest release)
#   PULSE_HOME            where the app and your data live
#   PULSE_BIN_DIR         where the pulse command goes (default: ~/.local/bin)
#   PULSE_NO_MODIFY_PATH  set to 1 to leave your shell profile alone
#   PULSE_FROM_SOURCE     set to 1 to build from the main branch instead of a release
#   PULSE_DOWNLOAD_URL    a folder (https:// or file://) holding the release files, for a mirror
#   PULSE_SOURCE_URL      a source archive (.tar.gz) to build from, for a mirror
#   PULSE_NODE_MIRROR     a mirror of https://nodejs.org/dist
#
# Everything runs from main() on the last line, so a download cut off halfway
# runs nothing at all.
set -eu

REPO="antonysallas/open-project-pulse"
NODE_VERSION="24.22.2" # used only when this machine has no suitable Node.js
NODE_MIN_MAJOR=20
ARCHIVE="open-project-pulse.tar.gz"

say() { printf '%s\n' "$*"; }
err() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}
have() { command -v "$1" >/dev/null 2>&1; }

fetch() { # URL FILE
  if have curl; then
    curl -fLsS --retry 2 -o "$2" "$1"
  else
    wget -q -O "$2" "$1"
  fi
}

sha256_of() {
  if have sha256sum; then
    sha256sum "$1" | cut -d' ' -f1
  elif have shasum; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    err "need sha256sum or shasum to check the download"
  fi
}

check_sha256() { # FILE EXPECTED
  actual=$(sha256_of "$1")
  [ -n "$2" ] && [ "$actual" = "$2" ] ||
    err "checksum mismatch on $(basename "$1"): expected ${2:-nothing}, got $actual. Nothing was installed."
}

node_is_good() { # NODE_BINARY
  major=$("$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null) || return 1
  [ "$major" -ge "$NODE_MIN_MAJOR" ] 2>/dev/null
}

# Sets NODE_BIN to a Node.js that can run Pulse, downloading one if needed.
ensure_node() {
  own="$PULSE_HOME/node/bin/node"
  if have node && node_is_good node; then
    NODE_BIN=$(command -v node)
    # Replaced by a good system Node: the old private copy is no longer needed.
    rm -rf "$PULSE_HOME/node"
    say "Using Node.js $("$NODE_BIN" -v) from $NODE_BIN"
    return
  fi
  if [ -x "$own" ] && node_is_good "$own" && [ "$("$own" -v)" = "v$NODE_VERSION" ]; then
    NODE_BIN="$own"
    say "Using Pulse's own Node.js $("$NODE_BIN" -v)"
    return
  fi

  case "$(uname -s)" in
    Linux) os=linux ;;
    Darwin) os=darwin ;;
    *) err "this installer runs on Linux and macOS. On Windows, use install.ps1: see the README." ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) err "no Node.js download for $(uname -m). Install Node.js $NODE_MIN_MAJOR or later yourself, then run this again." ;;
  esac

  mirror="${PULSE_NODE_MIRROR:-https://nodejs.org/dist}"
  name="node-v$NODE_VERSION-$os-$arch"
  say "No Node.js $NODE_MIN_MAJOR or later here, so downloading Node.js $NODE_VERSION for Pulse's own use..."
  fetch "$mirror/v$NODE_VERSION/$name.tar.gz" "$TMP/$name.tar.gz" || err "couldn't download Node.js from $mirror"
  fetch "$mirror/v$NODE_VERSION/SHASUMS256.txt" "$TMP/SHASUMS256.txt" || err "couldn't download Node.js checksums from $mirror"
  check_sha256 "$TMP/$name.tar.gz" "$(awk -v f="$name.tar.gz" '$2 == f { print $1 }' "$TMP/SHASUMS256.txt")"
  tar -xzf "$TMP/$name.tar.gz" -C "$TMP"
  node_is_good "$TMP/$name/bin/node" ||
    err "the Node.js download doesn't run on this system. Install Node.js $NODE_MIN_MAJOR or later yourself, then run this again."
  rm -rf "$PULSE_HOME/node"
  mv "$TMP/$name" "$PULSE_HOME/node"
  NODE_BIN="$own"
}

# Sets RELEASE to a checked release archive. Returns 1 if the release doesn't exist.
download_release() {
  if [ -n "${PULSE_DOWNLOAD_URL:-}" ]; then
    base="$PULSE_DOWNLOAD_URL"
  elif [ -n "${PULSE_VERSION:-}" ] && [ "$PULSE_VERSION" != latest ]; then
    base="https://github.com/$REPO/releases/download/$PULSE_VERSION"
  else
    base="https://github.com/$REPO/releases/latest/download"
  fi
  fetch "$base/$ARCHIVE" "$TMP/$ARCHIVE" 2>/dev/null || return 1
  fetch "$base/$ARCHIVE.sha256" "$TMP/$ARCHIVE.sha256" || err "couldn't download the checksum for the release at $base"
  check_sha256 "$TMP/$ARCHIVE" "$(cut -d' ' -f1 "$TMP/$ARCHIVE.sha256")"
  RELEASE="$TMP/$ARCHIVE"
}

# Sets RELEASE to an archive built from source. Slower: needs a few hundred MB
# of build tools for a few minutes.
build_from_source() {
  url="${PULSE_SOURCE_URL:-https://github.com/$REPO/archive/refs/heads/main.tar.gz}"
  say "Building Pulse from source. This takes a few minutes..."
  fetch "$url" "$TMP/source.tar.gz" || err "couldn't download the source from $url"
  mkdir "$TMP/source"
  tar -xzf "$TMP/source.tar.gz" -C "$TMP/source" --strip-components=1
  npm_cli=$(dirname "$NODE_BIN")/npm
  [ -x "$npm_cli" ] || err "building from source needs npm, which didn't come with the Node.js at $NODE_BIN"
  (
    cd "$TMP/source"
    PATH="$(dirname "$NODE_BIN"):$PATH"
    export PATH
    npm ci >"$TMP/build.log" 2>&1 && sh scripts/package-release.sh >>"$TMP/build.log" 2>&1
  ) || {
    tail -n 30 "$TMP/build.log" >&2
    err "the build failed; its last lines are above"
  }
  RELEASE="$TMP/source/dist/$ARCHIVE"
}

install_app() {
  mkdir "$TMP/unpacked"
  tar -xzf "$RELEASE" -C "$TMP/unpacked"
  new="$TMP/unpacked/open-project-pulse"
  [ -f "$new/bin/pulse.js" ] && [ -f "$new/server/server.js" ] && [ -f "$new/build/index.html" ] ||
    err "the downloaded archive isn't a Pulse release. Nothing was installed."
  # Both are in PULSE_HOME, so the swap is two renames, and data/ is not involved.
  rm -rf "$PULSE_HOME/app.old"
  [ ! -d "$PULSE_HOME/app" ] || mv "$PULSE_HOME/app" "$PULSE_HOME/app.old"
  mv "$new" "$PULSE_HOME/app"
  rm -rf "$PULSE_HOME/app.old"
  mkdir -p "$PULSE_HOME/data"
  chmod 700 "$PULSE_HOME/data"
}

sh_quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }

install_launcher() {
  mkdir -p "$BIN_DIR"
  launcher="$BIN_DIR/pulse"
  # Prefer Pulse's own Node.js, else whatever `node` is on the PATH at the time.
  {
    say '#!/bin/sh'
    say '# Written by the Open Project Pulse installer.'
    say "PULSE_HOME=$(sh_quote "$PULSE_HOME")"
    say "PULSE_LAUNCHER=$(sh_quote "$launcher")"
    say 'export PULSE_HOME PULSE_LAUNCHER'
    say 'if [ -x "$PULSE_HOME/node/bin/node" ]; then NODE="$PULSE_HOME/node/bin/node"; else NODE=node; fi'
    say 'command -v "$NODE" >/dev/null 2>&1 || { echo "pulse: Node.js is missing. Run the installer again." >&2; exit 1; }'
    say 'exec "$NODE" "$PULSE_HOME/app/bin/pulse.js" "$@"'
  } >"$TMP/pulse"
  chmod 755 "$TMP/pulse"
  mv "$TMP/pulse" "$launcher"
}

# Adds the line to the shell's profile once. Prints nothing when already there.
add_line() { # FILE LINE
  [ ! -f "$1" ] || ! grep -qF "$2" "$1" || return 0
  mkdir -p "$(dirname "$1")"
  printf '\n# Added by the Open Project Pulse installer\n%s\n' "$2" >>"$1"
  say "Added $BIN_DIR to your PATH in $1"
}

setup_path() {
  ON_PATH=yes
  case ":$PATH:" in
    *":$BIN_DIR:"*) return ;;
  esac
  ON_PATH=no
  [ "${PULSE_NO_MODIFY_PATH:-}" != 1 ] || return 0
  case "${BIN_DIR#"$HOME"/}" in
    "$BIN_DIR") shown="$BIN_DIR" ;;
    *) shown="\$HOME/${BIN_DIR#"$HOME"/}" ;;
  esac
  line="export PATH=\"$shown:\$PATH\""
  case "$(basename "${SHELL:-sh}")" in
    zsh) add_line "${ZDOTDIR:-$HOME}/.zshrc" "$line" ;;
    bash)
      add_line "$HOME/.bashrc" "$line"
      # Terminal windows on macOS start login shells, which skip .bashrc.
      [ "$(uname -s)" != Darwin ] || add_line "$HOME/.bash_profile" "$line"
      ;;
    fish)
      add_line "${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/open-project-pulse.fish" "fish_add_path \"$BIN_DIR\""
      ;;
    *) add_line "$HOME/.profile" "$line" ;;
  esac
}

main() {
  [ -n "${HOME:-}" ] || err "HOME isn't set"
  have tar || err "tar is required"
  have curl || have wget || err "curl or wget is required"

  PULSE_HOME="${PULSE_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/open-project-pulse}"
  BIN_DIR="${PULSE_BIN_DIR:-$HOME/.local/bin}"
  mkdir -p "$PULSE_HOME"

  # Next to the install, so that moving the new app into place is one rename.
  TMP=$(mktemp -d "$PULSE_HOME/.install.XXXXXX")
  trap 'rm -rf "$TMP"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  ensure_node

  if [ "${PULSE_FROM_SOURCE:-}" = 1 ]; then
    build_from_source
  elif ! download_release; then
    if [ -n "${PULSE_DOWNLOAD_URL:-}" ] || { [ -n "${PULSE_VERSION:-}" ] && [ "$PULSE_VERSION" != latest ]; }; then
      err "couldn't find release ${PULSE_VERSION:-files at $PULSE_DOWNLOAD_URL}"
    fi
    say "No published release to download."
    build_from_source
  fi

  install_app
  install_launcher
  setup_path

  installed=$("$NODE_BIN" "$PULSE_HOME/app/bin/pulse.js" version) || err "Pulse was installed but doesn't start. Please report this."
  # Only into an empty data folder. Pulse works without it, so failing here isn't fatal.
  sample_note=$("$NODE_BIN" "$PULSE_HOME/app/bin/pulse.js" sample --if-new --data "$PULSE_HOME/data") ||
    sample_note="(The sample project couldn't be added. Pulse itself is fine.)"
  say ""
  say "$installed is installed."
  say ""
  if [ "$ON_PATH" = no ]; then
    say "Open a new terminal, or run this in this one:"
    say "  export PATH=\"$BIN_DIR:\$PATH\""
    say ""
  fi
  say "Start it with:  pulse"
  say "Your data:      $PULSE_HOME/data"
  if [ -n "$sample_note" ]; then
    say ""
    say "$sample_note"
  fi
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║                                           ║"
echo "  ║        ┌─┐┌─┐┌─┐┌┐┐                       ║"
echo "  ║        │ ││─┘├┤ │││                       ║"
echo "  ║        └─┘│  └─┘┘└┘                       ║"
echo "  ║   ┌─┐┬─┐┌─┐ ┐┌─┐┌─┐┌┐┐                    ║"
echo "  ║   │─┘│┐┘│ │ ││├┤ │  │                     ║"
echo "  ║   │  │└┘└─┘└┘│└─┘└─┘│                     ║"
echo "  ║          ┌─┐┬ ┐┬  ┌─┐┌─┐                  ║"
echo "  ║          │─┘│ ││  └─┐├┤                   ║"
echo "  ║          │  └─┘└─┘└─┘└─┘                  ║"
echo "  ║                                           ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""

# --- OS Detection ---
OS_NAME="Unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS_NAME="macOS $(sw_vers -productVersion 2>/dev/null || echo "")"
elif [[ "$OSTYPE" == "linux"* ]]; then
    if [ -f /etc/os-release ]; then
        OS_NAME=$(. /etc/os-release && echo "$NAME $VERSION_ID")
    else
        OS_NAME="Linux"
    fi
elif [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
    OS_NAME="Windows ($(uname -s))"
fi
echo "  OS Detected: $OS_NAME"
echo ""

# --- Node.js check / install ---

install_node_mac() {
    echo "Node.js is not installed."
    echo ""

    if command -v brew &> /dev/null; then
        echo "Homebrew detected. Installing Node.js..."
        brew install node
    else
        echo "Homebrew not found. Installing Homebrew first..."
        echo ""
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        if [ -f /opt/homebrew/bin/brew ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -f /usr/local/bin/brew ]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi

        echo ""
        echo "Installing Node.js..."
        brew install node
    fi
}

if ! command -v node &> /dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        install_node_mac
    else
        echo "ERROR: Node.js is not installed."
        echo ""
        echo "Install it for your system:"
        echo "  Ubuntu/Debian:  sudo apt install nodejs npm"
        echo "  Fedora:         sudo dnf install nodejs npm"
        echo "  Other:          https://nodejs.org/"
        echo ""
        echo "Then re-run: bash run.sh"
        exit 1
    fi
fi

NODE_VERSION=$(node --version)
MAJOR_VERSION=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)

if [ "$MAJOR_VERSION" -lt 16 ]; then
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
        echo "Node.js $NODE_VERSION is too old (need 16+). Upgrading..."
        brew upgrade node
        NODE_VERSION=$(node --version)
    else
        echo "ERROR: Node.js 16 or later is required (you have $NODE_VERSION)."
        echo "Please update from: https://nodejs.org/"
        exit 1
    fi
fi

# --- First-time setup (if needed) ---

NEEDS_SETUP=false

if [ ! -d "node_modules" ]; then
    NEEDS_SETUP=true
elif [ "package.json" -nt "node_modules" ]; then
    NEEDS_SETUP=true
fi

if [ ! -f "public/data/projects.json" ]; then
    NEEDS_SETUP=true
fi

if [ "$NEEDS_SETUP" = true ]; then
    echo "First-time setup detected. Setting things up..."
    echo ""

    echo "Installing dependencies (this may take a minute)..."
    npm install

    echo ""
    echo "Setting up project data..."

    DATA_DIR="public/data"
    mkdir -p "$DATA_DIR/projects"

    if [ ! -f "$DATA_DIR/projects.json" ]; then
        if [ -f "$DATA_DIR/projects.json.example" ]; then
            cp "$DATA_DIR/projects.json.example" "$DATA_DIR/projects.json"
            echo "  Created projects.json"
        else
            echo "  Warning: projects.json.example not found, skipping."
        fi
    fi

    for example_file in "$DATA_DIR"/projects/*.json.example; do
        [ -e "$example_file" ] || continue
        target="${example_file%.example}"
        if [ ! -f "$target" ]; then
            cp "$example_file" "$target"
            echo "  Created $(basename "$target")"
        fi
    done

    echo ""
    echo "Setup complete!"
    echo ""
else
    echo "Found Node.js $NODE_VERSION"
fi

# --- Find available port ---

DEFAULT_PORT=3011
PORT=$DEFAULT_PORT

is_port_taken() {
    if command -v lsof &> /dev/null; then
        lsof -iTCP:"$1" -sTCP:LISTEN &> /dev/null
    elif command -v ss &> /dev/null; then
        ss -tlnH "sport = :$1" 2>/dev/null | grep -q .
    elif command -v netstat &> /dev/null; then
        netstat -tln 2>/dev/null | grep -q ":$1 "
    else
        return 1
    fi
}

if is_port_taken "$PORT"; then
    echo "Port $PORT is already in use, finding an available port..."
    while is_port_taken "$PORT"; do
        PORT=$((PORT + 1))
        if [ "$PORT" -gt $((DEFAULT_PORT + 20)) ]; then
            echo "ERROR: Could not find an available port (tried $DEFAULT_PORT-$PORT)."
            echo "Please free up a port and try again."
            exit 1
        fi
    done
    echo "Using port $PORT instead."
    echo ""
fi

# --- Start ---

echo "  ▶ Starting at http://localhost:$PORT"
echo "  Press Ctrl+C to stop."
echo ""
PORT=$PORT npm start

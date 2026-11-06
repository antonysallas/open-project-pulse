#!/bin/sh
# Builds dist/open-project-pulse.tar.gz and its checksum: what install.sh
# installs. It holds the built app and the server, nothing else.
set -eu
cd "$(dirname "$0")/.."

# The build copies everything in public/ into the app, so your reports or logos
# left there would ship to everyone who installs this.
unexpected=$(find public -mindepth 1 ! -name index.html ! -name manifest.json)
if [ -n "$unexpected" ]; then
  echo "error: these would be packaged. Move them out of public/ first:" >&2
  echo "$unexpected" >&2
  exit 1
fi

# The sample ships to everyone too, and must only ever be made-up data.
unexpected=$(find sample -mindepth 1 ! -name project.json ! -name org-logo.svg ! -name 'report-[0-9]*.json')
if [ -n "$unexpected" ]; then
  echo "error: these would be packaged. Move them out of sample/ first:" >&2
  echo "$unexpected" >&2
  exit 1
fi

rm -rf build dist
npm run build

stage=dist/open-project-pulse
mkdir -p "$stage/bin" "$stage/server"
cp -R build "$stage/build"
cp bin/pulse.js "$stage/bin/"
cp server/api.js server/sample.js server/server.js "$stage/server/"
cp -R sample "$stage/sample"
cp package.json LICENSE README.md "$stage/"
# The bundled fonts and styles need their licences with every copy.
mkdir -p "$stage/src/styles/sallas" "$stage/src/styles/redhat"
cp src/styles/sallas/LICENSE "$stage/src/styles/sallas/"
cp src/styles/redhat/RED-HAT-FONTS-LICENSE.txt "$stage/src/styles/redhat/"

# Without these, the archive records the name of whoever built it.
if tar --version 2>/dev/null | grep -q GNU; then
  anonymous="--owner=0 --group=0 --numeric-owner"
else
  anonymous="--uid 0 --gid 0"
fi
# shellcheck disable=SC2086 # the flags are meant to split
tar $anonymous -czf dist/open-project-pulse.tar.gz -C dist open-project-pulse
rm -rf "$stage"

cd dist
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum open-project-pulse.tar.gz >open-project-pulse.tar.gz.sha256
else
  shasum -a 256 open-project-pulse.tar.gz >open-project-pulse.tar.gz.sha256
fi
echo "Packaged dist/open-project-pulse.tar.gz"

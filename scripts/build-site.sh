#!/usr/bin/env bash
# Builds the GitHub Pages site into _site/.
# Copies every tracked file except .github/, scripts/ and tests/, then publishes the
# version named in widgets/LATEST as widgets/latest/.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

version="$(tr -d '[:space:]' < widgets/LATEST)"
if ! [[ "$version" =~ ^v[0-9]+$ ]]; then
  echo "widgets/LATEST must contain a version like v1, got: '$version'" >&2
  exit 1
fi
if [ ! -f "widgets/$version/index.html" ]; then
  echo "widgets/LATEST points at $version, but widgets/$version/index.html does not exist" >&2
  exit 1
fi
if [ -e widgets/latest ]; then
  echo "widgets/latest is generated at publish time; remove it from the repo" >&2
  exit 1
fi

rm -rf _site
mkdir _site
git ls-files -z | grep -zv -e '^\.github/' -e '^scripts/' -e '^tests/' | xargs -0 cp --parents -t _site
cp -r "widgets/$version" _site/widgets/latest
touch _site/.nojekyll

echo "Published widgets/latest from widgets/$version"

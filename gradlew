#!/usr/bin/env sh
# SCRYVO source bundle: CI installs the pinned Gradle distribution before calling this.
# Locally, install Gradle 8.10.2 and run ./gradlew <tasks>.
set -eu
if ! command -v gradle >/dev/null 2>&1; then
  echo "Gradle 8.10.2 is required. GitHub Actions installs it automatically." >&2
  exit 1
fi
exec gradle "$@"

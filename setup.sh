#!/usr/bin/env bash
# One-time setup after cloning: download the three theme submodules.
set -e
git submodule update --init --recursive
echo "Done. Preview with:  hugo server --configDir sites/congo --themesDir themes"

#!/usr/bin/env bash
# Rebases the ImagePier commits onto a new Immich release.
#
#   imagepier/scripts/update-upstream.sh v3.5.0
#
# Steps:
#   1. fetch the official Immich tags
#   2. create a backup branch of the current state
#   3. rebase the ImagePier commits (everything since the previous Immich base) onto the new tag
# On conflicts, git rebase stops at the affected commit;
# resolve them, run "git rebase --continue", then run the tests.
set -euo pipefail

new_tag="${1:?Please pass an Immich version, e.g. v3.5.0}"
branch="imagepier"

if ! git remote | grep -qx immich; then
  git remote add immich https://github.com/immich-app/immich.git
fi
git fetch --tags immich

git rev-parse -q --verify "refs/tags/${new_tag}" >/dev/null \
  || { echo "Immich has no tag ${new_tag}." >&2; exit 1; }

git checkout "${branch}"
old_base=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' --exclude '*-ip.*' HEAD)
backup="backup/${branch}-before-${new_tag}-$(date +%Y%m%d-%H%M)"
git branch "${backup}"

echo "Previous Immich base: ${old_base}"
echo "New Immich base:      ${new_tag}"
echo "Backup branch:        ${backup}"
echo "ImagePier commits:"
git log --oneline "${old_base}..HEAD"

git rebase --onto "${new_tag}" "${old_base}" "${branch}"

echo
echo "Done. Next steps:"
echo "  1. run build/tests"
echo "  2. git push --force-with-lease origin ${branch}"
echo "  3. git tag ${new_tag}-ip.1 && git push origin ${new_tag}-ip.1"

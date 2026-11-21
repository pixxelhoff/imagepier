# ImagePier – maintainer guide

This document describes how ImagePier is built on top of Immich and how it stays updatable.
For features and installation see the [README](.github/README.md).

## Principles

1. **Stay close to Immich.** ImagePier changes as little Immich code as possible, so new Immich releases can be
   applied with few or no conflicts.
2. **Add, don't modify.** ImagePier code lives in its own folders. Immich files only get small hooks.
3. **Reuse Immich mechanisms** instead of adding database tables, API endpoints or UI pages where possible.
4. **Don't fork the mobile apps.** The official Immich apps must keep working against ImagePier.
5. **Neutral repository.** No names of organizations, people or internal systems in code, tests or docs.
   Use examples like "ACME", "Jane Doe", "John Smith".

## Repository layout

| Branch / tag | Content |
|---|---|
| `main` | unmodified Immich (never edited, not used for builds) |
| `imagepier` | **default branch:** an Immich release tag + ImagePier commits on top |
| `v3.4.2-ip.N` | ImagePier releases; the part before `-ip` is the underlying Immich version |

| Path | Content |
|---|---|
| `server/src/imagepier/` | server code (services, controller, tests) |
| `web/src/lib/imagepier/` | web code (components, translations) |
| `imagepier/` | deployment example and maintenance scripts |
| `.github/workflows/imagepier-*.yml` | ImagePier CI |
| `.github/README.md` | ImagePier README (shown by GitHub instead of Immich's `README.md`) |

### Hooks in Immich files

These are the only Immich files changed by ImagePier. Keep this list up to date – these are the places where
conflicts can occur during updates.

| File | Change |
|---|---|
| `server/src/services/index.ts` | registers `ImagePierUsageRightsService` |
| `server/src/controllers/index.ts` | registers `ImagePierUsageRightsController` |
| `web/src/lib/components/asset-viewer/DetailPanel.svelte` | shows `UsageRightsPanel` |
| `web/src/lib/components/timeline/actions/ChangeDescriptionAction.svelte` | adds the bulk edit menu entry |
| `web/src/lib/components/shared-components/search-bar/SearchFilters.svelte` | adds the "Usage rights" search tab |

## Usage rights – technical overview

- Stored in Immich's generic asset metadata (`asset_metadata`, key `imagepier.usage-rights`, JSON).
  Reading and writing use Immich's existing `/api/assets/:id/metadata` endpoints and permission checks.
- `ImagePierUsageRightsService`
  - on `AssetMetadataExtracted`: suggests usage rights (exiftool tags, file name) and syncs tags
  - mirrors usage rights into tags below `Usage rights/` (or `Nutzungsrechte/` with `IMAGEPIER_LANGUAGE=de`)
  - daily at 03:17: re-evaluates license status and sends in-app notifications
- `ImagePierUsageRightsController` (`/api/imagepier/usage-rights/*`, excluded from the OpenAPI spec)
  - `GET config` – tag paths used by the web search tab
  - `POST sync` – re-syncs tags after the web app saved usage rights
- Web UI texts are in `web/src/lib/imagepier/i18n.ts`, not in Immich's `i18n/` files.

## Updating to a new Immich release

```bash
imagepier/scripts/update-upstream.sh v3.5.0
```

The script fetches the Immich tags, creates a backup branch and rebases the ImagePier commits onto the new release.
Resolve conflicts if needed, then push with `--force-with-lease`, wait for the test workflow and tag the release
(`v3.5.0-ip.1`). The build workflow publishes the image automatically.

Keep the number of ImagePier commits small – squash fix-up commits before tagging a release.

## CI workflows

| Workflow | Purpose |
|---|---|
| `imagepier-test.yml` | runs Immich's server and web checks (format, lint, type check, unit tests) |
| `imagepier-server.yml` | builds and publishes the server image for the `imagepier` branch and release tags |
| `imagepier-upstream-check.yml` | weekly trial rebase onto Immich `main` to detect upcoming conflicts early |

Immich's own workflows stay in the repository but are disabled or only react to `main`/`release/*` branches.
Do not use GitHub's "Sync fork" button – updates are done with the script above.

## Code conventions

ImagePier follows Immich's tooling (Prettier, ESLint with unicorn, TypeScript strict). Points that came up often:

- Imports are sorted case-sensitively (uppercase before lowercase), `type` specifiers last.
- Types used in decorated method signatures need `import type`.
- Don't reuse method names of `BaseService` (e.g. `getConfig`).
- Multi-line doc comments without `*` prefixes.
- Print width 120; Prettier joins lines that fit.

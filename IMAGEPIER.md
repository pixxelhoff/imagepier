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
| `server/src/services/index.ts` | registers `ImagePierAccessService`, `ImagePierUsageRightsService` |
| `server/src/controllers/index.ts` | registers the ImagePier access and usage rights controllers |
| `server/src/utils/access.ts` | `checkAccess` passes Immich's result through `applyImagePierAccess` (roles) |
| `server/src/services/asset.service.ts` | `deleteAll` with `force`: only administrators |
| `server/src/services/trash.service.ts` | `empty`: only administrators |
| `web/src/lib/components/shared-components/side-bar/UserSidebar.svelte` | adds the "Media library" entry |
| `web/src/routes/admin/users/[id]/+layout.svelte` | adds the "Role and permissions" card |
| `web/src/routes/(user)/partners/[userId]/[[photos=photos]]/[[assetId=id]]/+page.svelte` | media library actions in the selection bar |
| `web/src/lib/components/layouts/AdminPageLayout.svelte` | adds the "Media library" admin entry |
| `web/src/routes/admin/media-library/` | new admin page (areas); no Immich file changed |
| `web/src/lib/components/asset-viewer/DetailPanel.svelte` | shows `UsageRightsPanel` |
| `web/src/lib/components/timeline/actions/ChangeDescriptionAction.svelte` | adds the bulk edit menu entry |
| `web/src/lib/components/shared-components/search-bar/SearchFilters.svelte` | adds the "Usage rights" search tab |
| `server/src/services/asset-media.service.ts` | single downloads send a copy with usage rights credits |
| `server/src/services/download.service.ts` | ZIP downloads contain copies with usage rights credits |
| `web/vite.config.ts` | adds the build plugin `imagePierBranding()` (see Branding) |
| `web/static/` icons, `manifest.json` | replaced by ImagePier icons and name (on conflicts keep ImagePier's version) |

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
- Downloads (`download-credits.ts`): for JPEG, PNG, TIFF, WebP and HEIC files with usage rights, a temporary copy
  in `<tmp>/imagepier-downloads/` gets photographer, copyright, credit line and usage terms written by exiftool and is
  sent instead of the original. Copies older than one hour are removed. Internal notes are never written.

## Roles and media library – technical overview

- `server/src/imagepier/access-rules.ts`: roles, defaults and the in-memory copy of the settings. The settings are
  stored in `system_metadata` under `imagepier.access` (`libraryUserId`, role/upload/download per user).
- **Without a media library account the rules are inactive** and Immich's behaviour applies. Immich's own unit
  tests therefore run unchanged.
- `access.service.ts`: creates the media library account on startup (`IMAGEPIER_LIBRARY_EMAIL`,
  `IMAGEPIER_LIBRARY_NAME`), shares it with all non-external users as partner (`inTimeline`), repairs the sharing
  every 15 minutes and after a user is created.
- `access-hook.ts`: `AssetUpload` needs upload permission, `AssetDownload`/`AlbumDownload` need download permission,
  `AssetUpdate`/`AssetDelete` are extended to media library assets for media managers. Permanent deletion and
  emptying the trash are reserved for administrators.
- Areas: stored in the same settings (`areas`, the shared area `shared` always exists); a media manager's areas in
  `users[id].areas`. The area of an asset is stored in `asset_metadata` (`imagepier.area`) and mirrored as tag
  `Usage rights/Area/<name>`. The access service registers a resolver so that `access-hook.ts` can limit
  `AssetUpdate`/`AssetDelete` on media library assets to the manager's areas.
- `POST /api/imagepier/usage-rights/library` moves own assets into the media library (owner change) and/or sets the
  area. Faces of moved assets stay linked to the people of the previous owner.
- Endpoints (not in the OpenAPI spec): `GET /api/imagepier/access/me`,
  `GET|PUT /api/admin/imagepier/access/users/:id`, `GET|PUT /api/admin/imagepier/access/areas`.

## Branding – technical overview

Branding is applied at **build time** by the Vite plugin in `web/src/lib/imagepier/branding/vite-plugin.ts`,
so Immich source files stay untouched. The plugin is disabled in unit tests (`mode === 'test'`).

- Every import of `@immich/ui` resolves to `branding/ui.ts`, which re-exports the library with ImagePier's `Logo`
  and `immichLogo`. Logo images are static files in `web/static/imagepier/` (replaceable at runtime by a mount).
- `HIDDEN_COMPONENTS` turns Immich components into empty ones (the sidebar purchase reminder).
- `TEXT_REPLACEMENTS` changes literal strings such as page titles.
- Translation files (`i18n/*.json`): "Immich" becomes "ImagePier", except in keys about the Immich project itself
  (purchase, support, official resources, release announcements).

After an Immich update, check the web build log for `ImagePier branding not applied` – it lists replacements that no
longer match and need to be adjusted.

Not branded yet: e-mails, passkey name and API documentation (server side).

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
- Prefer an early `continue` over an `if` block at the end of a loop body (`unicorn/prefer-continue`).
- String replacements with a function as replacement (`replaceAll(search, () => value)`).

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
| `server/src/services/index.ts` | registers `ImagePierAccessService`, `ImagePierAuditService`, `ImagePierUsageRightsService` |
| `server/src/controllers/index.ts` | registers the ImagePier access, audit and usage rights controllers |
| `server/src/services/base.service.ts` | `createLoginResponse` reports logins to the audit log (`recordLogin`) |
| `server/src/utils/access.ts` | `checkAccess` passes Immich's result through `applyImagePierAccess` (roles) |
| `server/src/services/asset.service.ts` | `deleteAll` with `force`: media library assets only by media managers of their areas (`requirePermanentDeleteAccess`) |
| `web/src/lib/components/shared-components/side-bar/UserSidebar.svelte` | adds `MediaLibraryNavItem` (My photos, All photos, areas, website galleries) |
| `web/src/routes/(user)/photos/[[assetId=id]]/+page.svelte` | `withPartners` follows `photosScope` ("My photos" / "All photos") |
| `web/src/routes/admin/users/[id]/+layout.svelte` | adds the "Role and permissions" card |
| `web/src/routes/admin/users/(list)/+layout.svelte` | user list replaced by `UserListAdmin` (role, search, role filter, sorting) |
| `web/src/routes/(user)/partners/[userId]/[[photos=photos]]/[[assetId=id]]/+page.svelte` | media library actions in the selection bar |
| `web/src/lib/components/layouts/AdminPageLayout.svelte` | adds the "Areas", "Keywords", "Trash" and "Audit log" admin entries |
| `web/src/routes/admin/media-library/`, `web/src/routes/admin/keywords/`, `web/src/routes/admin/trash/`, `web/src/routes/admin/audit/` | new admin pages (areas; keyword list; trash of all areas; audit log); no Immich file changed |
| `web/src/lib/components/asset-viewer/DetailPanel.svelte` | shows `UsageRightsPanel` and `KeywordsPanel` |
| `web/src/lib/components/timeline/actions/ChangeDescriptionAction.svelte` | adds the bulk edit menu entries (usage rights, keywords, area) |
| `web/src/lib/components/shared-components/search-bar/SearchFilters.svelte` | adds the "Usage rights" search tab |
| `server/src/services/asset-media.service.ts` | single downloads send a copy with usage rights credits; audit log |
| `server/src/services/download.service.ts` | ZIP downloads contain copies with usage rights credits; audit log |
| `web/src/lib/components/layouts/UserPageLayout.svelte` | hides the upload button without upload permission |
| `web/src/routes/(user)/+layout.svelte` | no drag-and-drop upload without upload permission |
| `web/src/lib/components/asset-viewer/AssetViewerNavBar.svelte` | trash button for media library assets (`MediaLibraryDeleteAction`) |
| `server/src/emails/components/immich.layout.tsx`, `footer.template.tsx` | ImagePier logo, color and footer instead of Immich's (see E-mails) |
| `server/src/emails/welcome.email.tsx`, `test.email.tsx`, `album-invite.email.tsx`, `album-update.email.tsx` | German or English texts from `src/imagepier/mail.ts` |
| `server/src/services/notification.service.ts`, `notification-admin.service.ts` | e-mail subjects from `src/imagepier/mail.ts`; logo in the template preview |
| `server/src/repositories/email.repository.ts` | attaches the embedded logo (`getMailLogoAttachment`) |
| `server/src/services/passkey.service.ts` | passkey name `ImagePier` (rp id unchanged, existing passkeys keep working) |
| `server/src/services/shared-link.service.ts` | link preview image `/apple-icon-180.png` instead of Immich's promo image |
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

What each role and level may do is described for users in [PERMISSIONS.md](PERMISSIONS.md). Keep it up to date
when access rules change.

- `server/src/imagepier/access-rules.ts`: roles (`admin`, `staff`, `external`), area levels (`viewer`, `standard`,
  `editor`, `manager`) and the in-memory copy of the settings. The settings are stored in `system_metadata` under
  `imagepier.access` (`libraryUserId`, `areas` with the `userId` of each area account, `areaAssetsMigrated`, and per
  user `role` and `areas: { [areaId]: level }`). Settings of
  earlier versions are converted when read: the former role `manager` becomes `staff` with the level `manager` in the
  former areas. Externals cannot have the level `manager`.
- **Without a media library account the rules are inactive** and Immich's behaviour applies. Immich's own unit
  tests therefore run unchanged.
- **One technical account per area** owns the assets of the area; the area of an asset is the area of its owner.
  The shared area uses the original media library account (`IMAGEPIER_LIBRARY_EMAIL`, `IMAGEPIER_LIBRARY_NAME`);
  every other area gets `media-library+<areaId>@…` with the name `<library name>: <area name>`.
- `access.service.ts`: creates the media library account and the area accounts on startup, shares each area account
  as partner (`inTimeline`) with the users who have a level in the area, and repairs the sharing every 15 minutes,
  after a user is created and after areas or levels change. Timeline, search, map and mobile apps therefore only
  show the areas a user has access to. Removing an area is refused while its account owns assets (including the
  trash); the account of an empty area is deleted like a user deleted by an administrator.
- Upgrade from releases with a single media library account: once after the area accounts exist,
  `migrateAreaAssets` (usage rights service) moves every asset of the media library account whose `imagepier.area`
  points to another area to that area's account and re-syncs its tags (`areaAssetsMigrated` is set afterwards).
- `access-hook.ts` (per area, via the asset owner resolver): `AssetDownload` of media library assets needs `standard`,
  `AssetUpdate`/`AssetDelete` need `editor`; permanent deletion (`requirePermanentDeleteAccess`) needs `manager`.
  `TagRead` covers the tags of the area accounts with a level. Own assets are not restricted. Externals with the
  level `editor` only edit and trash assets they added themselves (`asset_metadata` key `imagepier.uploaded-by`,
  written when own assets are moved into an area; resolved via the asset uploader resolver).
- `applyMetadataRules` (called from Immich's asset metadata endpoints): the keys `imagepier.area` and
  `imagepier.uploaded-by` are reserved for the server; usage rights of media library assets saved with status
  `confirmed` by anyone but admins and media managers of the area are stored as `suggested` (to be reviewed).
- Uploads in the view of an area (upload button of the navigation bar, drag and drop) are assigned to the area when
  the user is editor there (`upload-access.svelte.ts`, hook in `fileUploadHandler`).
- Shared links (`shared-link.service.ts`): media library assets can only be shared by staff with the level editor
  in their areas (`requireShareableAssets`); album links are checked against the album's assets when created.
- Website galleries only show media library assets of areas where the creator of the gallery is editor or media
  manager, plus the creator's own assets (administrators: everything).
- Trash of the areas: `GET /api/imagepier/library/trash` returns the trashed assets of the areas where the user is
  editor or media manager (externals: only their deliveries); page `/media-library/trash`, also used in the
  administration. Editors restore, media managers and admins delete permanently.
- Audit log: confirmations of usage rights are logged as `usage_rights_confirm`.
- Areas: stored in the same settings (`areas`, the area `shared` always exists). The area is also stored in
  `asset_metadata` (`imagepier.area`) and mirrored as tag `Usage rights/Area/<name>`.
  `GET /api/admin/imagepier/access/areas` returns the number of media managers per area, so the administration can
  warn about areas without one.
- `POST /api/imagepier/usage-rights/library` moves own assets and media library assets into an area (owner change to
  the area account). Their files (original, thumbnails, encoded videos, the video part of live photos) move into the
  folders of the area account (`asset-files.ts`, Immich's `StorageCore.moveFile`), because Immich removes the folders
  of a deleted user. Assets assigned by earlier releases are moved once on startup (`areaFilesMoved`). Faces of moved assets stay linked to the people of the previous owner. The usage rights search
  works per area, because Immich combines tag filters with AND and every area account has its own tags.
- Endpoints (not in the OpenAPI spec): `GET /api/imagepier/access/me`, `GET /api/admin/imagepier/access/users`
  (role of every account for the user list), `GET|PUT /api/admin/imagepier/access/users/:id`,
  `GET|PUT /api/admin/imagepier/access/areas`.
- The in-memory copy of the settings exists only in the API worker. Code that runs in the microservices worker
  (event handlers after jobs, e.g. the tag sync after the metadata extraction) reads the settings from
  `system_metadata` instead.
- Sidebar below *Photos*: *My photos* (timeline without partners), *All photos* (with the media library, which is
  always shared with `inTimeline`; `syncLibrarySharing` turns it on again) and one entry per area. An area page
  (`web/src/routes/(user)/media-library/[areaId]/`) shows the media library timeline filtered by the area tag; users
  who can view the media library get `TagRead` on its tags for this.
- Admins additionally get `AssetRead`/`AssetView` on media library assets, so they can see them in the trash
  (Immich's partner sharing hides trashed assets).

## Website galleries – technical overview

- Galleries and their branding are stored in `system_metadata` (`imagepier.galleries`); each gallery publishes one
  album under a random key. `ImagePierGalleryService` reads the album assets with plain SQL and filters them with
  `isPublishable()` (confirmed rights, website or press use, not expired); the result is cached for one minute.
- Public endpoints (`@Authenticated({ public: true })`): `GET /api/imagepier/gallery/:key`,
  `GET /api/imagepier/gallery/:key/assets/:id?size=thumbnail|preview`, `GET /api/imagepier/gallery/:key/assets/:id/download`
  (original with usage rights credits, counted in the audit log). Every file request checks that the asset is published.
- ZIP archives: `GET /api/imagepier/gallery/:key/download` (all published assets) and `POST` to the same path with a
  form field `ids` (comma separated, for a selection; a form post avoids long URLs). Files get usage rights credits like
  single downloads; the download is recorded once with all asset IDs.
- Management: `GET|POST /api/imagepier/galleries` (`GET` also returns the default branding),
  `PUT|DELETE /api/imagepier/galleries/:id`, `GET|PUT /api/admin/imagepier/gallery/branding`.
- Branding: the admin sets a default; each gallery can store its own values (`gallery.branding`). Empty values fall
  back to the default (`mergeBranding()`).
- Web: public page `web/src/routes/gallery/[key]/` (no login), management page `web/src/routes/(user)/galleries/`,
  sidebar entry in `MediaLibraryNavItem.svelte`. No Immich file changed.

## Keyword list – technical overview

- List in `system_metadata` (`imagepier.keywords`): `{ keywords: [{ category, name, description?, active }] }`,
  maintained under *Administration → Keywords* (`/admin/keywords`, rows pasted from a spreadsheet; keywords missing in
  a new import are deactivated). Server: `src/imagepier/keywords.ts`, `keyword.service.ts`, `keyword.controller.ts`.
- A keyword is the Immich tag `Category/Keyword` of the asset owner (own account or area account). Adding or removing
  keywords also updates the locked `tags` column of the asset's EXIF data and queues `SidecarWrite`, like Immich's tag
  service, so a new metadata extraction keeps them. Usage rights tags are left out of the EXIF tags.
- `moveToLibrary` moves all tags of an asset to the new owner (`moveTagsToOwner`).
- Endpoints: `GET|PUT /api/imagepier/keywords` (PUT admin only), `GET /api/imagepier/keywords/assets/:id`,
  `PUT /api/imagepier/keywords/assets` (`{ assetIds, add, remove }`, needs `AssetUpdate`; only active keywords can be
  added).
- Planned: keyword search across areas, free tags only for administrators.
- User-facing differences to Immich are listed in [DIFFERENCES.md](DIFFERENCES.md); keep it up to date.

## Audit log – technical overview

- Table `imagepier_audit`, created by `ImagePierAuditService` with `CREATE TABLE IF NOT EXISTS` (no Immich
  migration: Immich runs migrations strictly by timestamp, and its schema check ignores additional tables). The table
  is part of every database backup.
- Code reports actions with `recordAudit()` / `recordAuditFor()` / `recordDownload()` / `recordLogin()` from
  `server/src/imagepier/audit.ts`; the service registers itself as sink. Without a sink (unit tests) nothing happens.
- Events: `AssetCreate` (uploads), `AssetTrashAll`, `AssetRestoreAll`, `AssetDeleteAll`, `UserCreate`, `UserTrash`.
  Controllers record usage rights syncs, moves into the media library, role and area changes.
- Settings in `system_metadata` (`imagepier.audit`): `retentionDays` (365), `downloadsWithUser` (false), `logins`
  (false); re-read every minute by every worker. A cron job removes old entries at 03:41.
- Endpoints: `GET /api/admin/imagepier/audit`, `GET /api/admin/imagepier/audit/users`,
  `GET|PUT /api/admin/imagepier/audit/settings`, `GET /api/imagepier/library/trash` (areas where the user is editor;
  admins see all areas). The trash is shown in Administration → Trash (admins) and at `/media-library/trash`
  (editors and media managers of their areas).

## Branding – technical overview

Branding is applied at **build time** by the Vite plugin in `web/src/lib/imagepier/branding/vite-plugin.ts`,
so Immich source files stay untouched. The plugin is disabled in unit tests (`mode === 'test'`).

- Every import of `@immich/ui` resolves to `branding/ui.ts`, which re-exports the library with ImagePier's `Logo`
  and `immichLogo`. Logo images are static files in `web/static/imagepier/` (replaceable at runtime by a mount).
- `HIDDEN_COMPONENTS` turns Immich components into empty ones (the sidebar purchase reminder).
- `TEXT_REPLACEMENTS` changes literal strings such as page titles.
- Translation files (`i18n/*.json`): "Immich" becomes "ImagePier", except in keys about the Immich project itself
  (purchase, support, official resources, release announcements). `TRANSLATION_OVERRIDES` replaces single
  translations per language (German: "Administration" instead of "Verwaltung").

After an Immich update, check the web build log for `ImagePier branding not applied` – it lists replacements that no
longer match and need to be adjusted.

Intentionally unchanged: the API documentation (`/doc`, generated from the Immich OpenAPI spec), links to
docs.immich.app in the administration, Immich in the "About" dialog and the official mobile apps.

- The Logo component used inside `@immich/ui` (for example the title icon of every modal) is redirected to
  `branding/Logo.svelte` in `resolveId`.
- "Support & feedback" lists ImagePier (`IMMICH_THIRD_PARTY_*` in the compose override) and hides the official Immich
  resources as long as third-party links are set.

### E-mails

Immich's React Email components in `server/src/emails` render ImagePier's frame instead of Immich's: a word mark
(or logo), an accent color and a neutral footer without app store badges or links to immich.app. Texts and subjects
come from `server/src/imagepier/mail.ts` (German with `IMAGEPIER_LANGUAGE=de`). Custom templates from
Administration → Settings → Notifications still replace the text inside the frame. The license e-mails
(`license.email.tsx`, `futo.layout.tsx`) are not used by ImagePier and stay unchanged.

| Variable | Default | Meaning |
|---|---|---|
| `IMAGEPIER_MAIL_NAME` | `ImagePier` | name in the word mark, footer and subjects |
| `IMAGEPIER_MAIL_COLOR` | `#6b46e5` | accent color of buttons and links (`#rrggbb`) |
| `IMAGEPIER_MAIL_LOGO_URL` | embedded logo | https URL of a PNG or JPEG logo instead of the embedded one |

By default the layout references `cid:imagepier-logo`. `EmailRepository.sendEmail` then attaches the web app's word
mark (`/build/www/imagepier/logo-inline-light.svg`, so a mounted custom logo is used too), rendered once as PNG
with sharp into the temp folder. The template preview in the administration shows it as inline image. Without the
SVG file (unit tests) the name is shown as text.

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

# ImagePier

**A self-hosted media library for organizations – built on [Immich](https://github.com/immich-app/immich).**

ImagePier keeps everything that makes Immich great – fast uploads, timeline, albums, face and object search,
mobile apps – and adds what teams need to work with photos professionally: usage rights, licenses and photo credits
for every image, and soon shared libraries with roles and an embeddable website gallery.

> [!NOTE]
> ImagePier is an independent fork and **not affiliated with or supported by the Immich team**.
> Please report issues that only occur in ImagePier here, not in the Immich repository.

## Features

### Usage rights for every asset

- **Usage rights panel** in the info sidebar of the asset viewer: photographer, copyright holder, credit line,
  license type, license source, permitted usage (internal, web, print, social media, press), expiry date and notes.
- **Automatic suggestions** after upload from embedded IPTC/XMP/EXIF metadata (By-line, Creator, Artist,
  Copyright Notice, Rights, Copyright, Credit) and from file names like `Harbour Festival (c) ACME, Jane Doe.jpg`.
  Suggestions are marked for review and never overwrite existing entries.
- **Bulk editing** for many assets at once – only filled-in fields are applied, everything else stays as it is.
- **Copy credit line** with one click, ready to paste below a photo on a website or in print.
- **Credits in downloaded files** – when an asset is downloaded (single file, ZIP archive, shared link or mobile app),
  photographer, copyright, credit line and usage terms are written into the file's IPTC/XMP/EXIF metadata.
  The original in the library stays untouched; supported formats: JPEG, PNG, TIFF, WebP, HEIC.

### Search and license monitoring

- **"Usage rights" tab in the search dialog** – filter by photographer, copyright holder, license type and license
  status (valid, expiring soon, expired, unreviewed), combined with all other Immich filters.
- **Daily license check** – licenses expiring within 30 days and expired licenses are flagged, and asset owners
  receive an in-app notification.
- Works in the **official Immich mobile apps** as well: usage rights are mirrored into Immich tags
  (e.g. `Usage rights/Status/Expired`), so they can be found with the regular tag filter.

### Own look

- **ImagePier name and logo** in the web app, browser tab and installed web app (PWA). Immich is still credited in
  the "About" dialog.
- **Your own logo** without rebuilding: mount a folder with your logo files (see [Custom logo](#custom-logo)).
- No purchase reminder in the sidebar. Immich licenses can still be bought and managed under
  *Account settings → Purchase* to support the Immich project.

### Planned

- **Roles and shared library** – administrators, media managers per department, staff with read and download access,
  external users; single sign-on via OpenID Connect (e.g. Keycloak in front of LDAP).
- **Website gallery** – embeddable albums for websites and content management systems with a download dialog that
  shows license terms and the credit line before the download starts.

## Installation

ImagePier replaces only the Immich **server** container. Machine learning, PostgreSQL and Redis keep using the
official Immich images, and existing Immich data is used as it is.

> [!IMPORTANT]
> Use an ImagePier release that matches your current Immich version (e.g. `v3.4.2-ip.4` for Immich `v3.4.2`).
> Downgrading Immich is not supported. Always create a database backup before switching.

1. Start from a working [Immich Docker Compose installation](https://docs.immich.app/install/docker-compose).
2. Pin the Immich version and choose an ImagePier release in `.env`:

   ```bash
   IMMICH_VERSION=v3.4.2
   IMAGEPIER_VERSION=v3.4.2-ip.4
   IMAGEPIER_LANGUAGE=en   # language of usage rights tags and notifications: en, de
   ```

3. Copy [`imagepier/deploy/docker-compose.override.yml`](../imagepier/deploy/docker-compose.override.yml) next to
   your `docker-compose.yml`. Docker Compose picks it up automatically.
4. Restart:

   ```bash
   docker compose pull && docker compose up -d
   ```

The "About" dialog in the web app now shows `pixxelhoff/imagepier` as repository.

To get usage rights suggestions for assets uploaded before switching, run the job
*Administration → Jobs → Extract metadata → All* or use *Refresh metadata* on single assets.

### Custom logo

The logo files are served from `/imagepier/` of the web app. To use your own logo, create a folder with these
files and mount it in `docker-compose.override.yml` (see the commented example there):

| File | Used for |
|---|---|
| `logo-icon.svg` | picture mark (collapsed sidebar, shared links, onboarding) |
| `logo-inline-light.svg` / `logo-inline-dark.svg` | word mark in the top bar (light / dark theme) |
| `logo-stacked-light.svg` / `logo-stacked-dark.svg` | picture mark above word mark on the login page |

Start from the [default files](../web/static/imagepier/) and keep the height-based proportions (the inline logos are
displayed with a fixed height). Browser icon (favicon) and app icons stay ImagePier's.

### Automatic container updates

If you use tools like Watchtower, exclude the server and machine learning containers – they must be updated
together with a matching ImagePier release. The override file already sets the Watchtower exclusion label for both.

### Switching back to Immich

ImagePier does not change Immich's database schema. Remove `docker-compose.override.yml` and restart to return to
the official Immich server of the same version. Usage rights stay stored in Immich's asset metadata, and the
`Usage rights/…` tags remain as regular tags.

## Releases and versions

| Tag | Meaning |
|---|---|
| `v3.4.2-ip.4` | ImagePier release 4 based on Immich `v3.4.2` |
| `release` | latest ImagePier release |
| `edge` | latest build of the `imagepier` branch – for testing only |

Images: `ghcr.io/pixxelhoff/imagepier-server`

## Development

See [IMAGEPIER.md](../IMAGEPIER.md) for the repository layout, how ImagePier stays updatable with new Immich
releases, the CI workflows and the code conventions.

## License

ImagePier is licensed under the [GNU Affero General Public License v3.0](../LICENSE), like Immich.
The complete source code of every published version is available in this repository.

Immich is a trademark of its respective owners. ImagePier is an independent project based on Immich's open source code.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../web/static/imagepier/logo-stacked-dark.svg">
    <img src="../web/static/imagepier/logo-stacked-light.svg" alt="ImagePier" width="260">
  </picture>
</p>

<h3 align="center">The self-hosted media library for teams – built on Immich</h3>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-3F51B5?style=for-the-badge" alt="License: AGPL v3"></a>
  <a href="https://github.com/immich-app/immich"><img src="https://img.shields.io/badge/based_on-Immich_v3.4.2-4250af?style=for-the-badge" alt="Based on Immich v3.4.2"></a>
  <img src="https://img.shields.io/badge/status-in_development-e0a100?style=for-the-badge" alt="Status: in development">
  <a href="https://github.com/pixxelhoff/imagepier/pkgs/container/imagepier-server"><img src="https://img.shields.io/badge/image-ghcr.io-a66cff?style=for-the-badge" alt="Container image on ghcr.io"></a>
</p>

<p align="center"><b>English</b> · <a href="README.de.md">Deutsch</a></p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#releases-and-versions">Releases</a> ·
  <a href="#development">Development</a> ·
  <a href="#about">About</a>
</p>

---

> [!WARNING]
> **ImagePier is still under active development and not recommended for production use yet.**
> Features, permissions and data structures can still change between releases, and upgrades may require manual
> steps. Try it on a test installation with sample photos, and keep backups of your database and library.

ImagePier keeps everything that makes [Immich](https://github.com/immich-app/immich) great – fast uploads, timeline,
albums, face and object search, mobile apps – and adds what teams need to work with photos professionally:

- 📝 **Usage rights, licenses and photo credits** for every image – also written into downloaded files
- ✅ **A release status** (in review, approved, approved with restrictions, blocked) decided by media managers
- 🗂️ **A shared media library** with roles, areas (departments) and its own trash
- 🏷️ **A controlled keyword list** for consistent tagging and searching
- 🌐 **Public website galleries** that only show images cleared for publication
- 📋 **An audit log** of uploads, downloads and changes

> [!NOTE]
> ImagePier is an independent fork and **not affiliated with or supported by the Immich team**.
> Please report issues that only occur in ImagePier here, not in the Immich repository.

## Features

### 📝 Usage rights for every asset

- **Usage rights panel** in the info sidebar of the asset viewer: photographer, copyright holder, credit line,
  license type, license source, permitted usage (internal, web, print, social media, press), expiry date and notes.
- **Automatic suggestions** after upload from embedded IPTC/XMP/EXIF metadata (By-line, Creator, Artist,
  Copyright Notice, Rights, Copyright, Credit) and from file names like `Harbour Festival (c) ACME, Jane Doe.jpg`.
  Suggestions are marked for review and never overwrite existing entries.
- **Title and alternative text** – also written into downloaded files (XMP/IPTC) and used in website galleries.
- **Scope of rights** – territory, editing (allowed, cropping only, not allowed), passing on to third parties,
  exclusivity, and additional checks (recognizable people, minors, music/artworks/brands, drone, private property),
  each *does not apply*, *open* or *cleared*; open checks are highlighted. Plus a link to the rights document.
- **Import page** – *Import* in the sidebar (level editor): choose a folder or files, check them against the image
  guideline (long edge at least 3,000 px, taken 2021 or later, duplicates in the selection, files already in
  ImagePier), set area, keywords and usage rights for all files, name them by a scheme
  (`topic-subject-place-year-c-author-001.jpg`) and upload them. The original files stay unchanged; a log can be
  downloaded as CSV.
- **Import interface** – tools upload with Immich's upload endpoint and then set area, keywords and usage rights
  for a whole batch with one request (`POST /api/imagepier/import`, API key of the person importing).
- **Channels** – for every channel (internal, web, print, social media, press, social ads, presentations, partners,
  paid campaigns) *permitted*, *not permitted* or *under conditions*, with a note on the conditions. Administrators
  adjust the channel list under *Administration → Channels*.
- **Release status** – *In review*, *Approved*, *Approved with restrictions* (with a note on the restriction) or
  *Blocked*; *Expired* is shown automatically after the expiry date. Media managers of the area decide the status;
  changes by editors put approved photos back to *in review*, blocked photos stay blocked.
- **Blocked photos** cannot be downloaded (except by media managers and administrators), are refused for new shared
  links, are hidden in existing shared links and never appear in website galleries.
- **Bulk editing** for many assets at once – in an area, in *All photos* or in search results. Only filled-in fields
  are applied, everything else stays as it is.
- **Copy credit line** with one click, ready to paste below a photo on a website or in print.
- **Credits in downloaded files** – when an asset is downloaded (single file, ZIP archive, shared link, gallery or
  mobile app), photographer, copyright, credit line and usage terms are written into the file's IPTC/XMP/EXIF
  metadata. The original in the library stays untouched; supported formats: JPEG, PNG, TIFF, WebP, HEIC.

### 🔎 Search and license monitoring

- **"Usage rights" tab in the search dialog** – filter by photographer, copyright holder, license type, license
  status (approved, approved with restrictions, expiring soon, expired, blocked, in review), permitted usage, license source, credit line, expiry year and
  area, combined with all other Immich filters.
- **Find missing information** – every asset without copyright holder, photographer or license is tagged
  (`Usage rights/Missing/…`), so incomplete assets can be found and completed.
- **Daily license check** – licenses expiring within 30 days and expired licenses are flagged, and asset owners
  receive an in-app notification.
- Works in the **official Immich mobile apps** as well: usage rights are mirrored into Immich tags
  (e.g. `Usage rights/Status/Expired`), so they can be found with the regular tag filter.

### 🗂️ Roles and shared media library

- **Areas (departments) with their own accounts** – the official media belong to technical accounts, one per area.
  Each area is only shared with the people who have a level in it, so timeline, search, map and the mobile apps
  only show the areas someone has access to. Below *Photos* in the sidebar, everybody switches between *My photos*,
  *All photos* (own photos and all accessible areas) and one entry per area.
- **Roles per account** (*Administration → Users → user → Role and permissions*): *Administrator* (everything),
  *Staff* and *External*. Access to the media library is granted **per area** with a level:

  | Level | Can do in the area |
  |---|---|
  | **View only** | view, add to own albums |
  | **Standard** | + download |
  | **Editor** | + upload, maintain usage rights, move to the trash and restore, share links and galleries |
  | **Media manager** | + permanent deletion (staff only; every area should have at least one) |

  Without a level the area is not accessible. Own photos are not restricted – everybody can upload, share and delete
  them. **The full permission matrix** (externals, trash, sharing, galleries) is in
  [PERMISSIONS.md](../PERMISSIONS.md). **Everything that behaves differently from Immich** is listed in
  [DIFFERENCES.md](../DIFFERENCES.md).
- **User list with roles** – *Administration → Users* shows the role of every account and can be searched, filtered
  by role and sorted by name, e-mail or role.
- **Managing areas** – administrators create, rename and remove areas under *Administration → Areas*; areas
  without a media manager are marked, and areas that still contain images cannot be removed. Each media library
  asset shows its area, and the usage rights search works per area.
- **Assign to area** – own assets can be assigned to an area with the level *Editor* or higher (selection menu or
  the menu of a single photo); editors can also upload directly in the view of an area.
- **Approving usage rights** – usage rights entered by editors stay *in review* until a media manager of the area
  (or an administrator) decides the release status. Only approved usage rights count for website galleries.
- **People across areas** – the media library and all areas share one face recognition: a person is recognized in
  every area, a name given once applies everywhere, and the people overview shows the people of all accessible
  areas.
- **Map across areas** – the map shows the locations of the own photos and of all accessible areas.
- **External photographers** – externals with the level *Editor* deliver photos into an area and maintain the usage
  rights of their own deliveries; they cannot move other photos, share links or publish galleries.
- **Trash per area** – editors and media managers find *Trash of the areas* in the sidebar,
  filterable by area; editors restore, media managers delete permanently. Administrators see the trash of all areas
  under *Administration → Trash*.
- **Sharing** – shared links and website galleries only contain media library photos of areas where the person
  sharing is at least *Editor*.

### 🏷️ Keyword list

- **One keyword list for everybody** – administrators paste the keyword list (category, keyword, description) from a
  spreadsheet under *Administration → Keywords*, or add and edit single keywords there. Renaming a keyword renames it
  on all photos; unused keywords can be deleted, keywords in use can be deactivated. The list can be downloaded as
  a CSV file for Excel.
- **Assigning keywords** – in the *Keywords* panel of a photo or for a selection (in an area, in *All photos* or in
  search results), grouped by category. Keywords are stored as Immich tags `Category/Keyword` of the account that
  owns the photo, so they work for photos of areas as well and are written to the XMP sidecar like Immich tags.
- **Keyword search** – the search tab *Keywords* finds photos with all selected keywords in the own photos and all
  accessible areas at once.
- Once a keyword list exists, only administrators create new tags, so the vocabulary stays consistent. Immich's own
  tag feature is reserved for administrators; everybody else works with the keyword list.
- Moving a photo into an area keeps its tags.

### 🌐 Website galleries

Administrators, editors and media managers (staff only, not externals) publish albums as public galleries under
*Website galleries* in the sidebar – everyone except administrators only their own albums. Each gallery gets a random link (`/gallery/<key>`) that can be linked from a
website or embedded in an iframe – no login needed for visitors.

- Only images with **approved usage rights for a gallery channel** that have **not expired** are shown.
  Administrators choose the gallery channels under *Administration → Channels* (by default website and press). The
  filter runs on the server, so the rest of the album stays private.
- Every image shows its credit line. Visitors confirm the license terms before downloading – single images, a
  selection or the whole gallery as ZIP file.
- **Own look** – administrators set a default heading, accent color, logo, footer text and links to imprint and
  privacy policy. Each gallery can override single values.
- Downloads can be disabled per gallery and are counted in the audit log (no personal data of visitors).

### 📋 Audit log

Under *Administration → Audit log* administrators see uploads, downloads, usage rights changes, moves into the media
library, trash, restore and permanent deletion, role and area changes, published galleries and created or deleted
accounts – filterable by action, person and period, with CSV export.

- **Retention** – 365 days by default, adjustable; older entries are removed every night.
- **Downloads** – only counted by default. Storing who downloaded can be enabled; this records employee behaviour,
  so agree on it with your works council and data protection officer first.
- **Logins** – optional, off by default.

### 🎨 Own look

- **ImagePier name and logo** in the web app, browser tab and installed web app (PWA). Immich is still credited in
  the "About" dialog.
- **Your own logo** without rebuilding: mount a folder with your logo files (see [Custom logo](#custom-logo)).
- **E-mails in ImagePier design** – welcome, test and album e-mails show the ImagePier logo (or your own logo from
  the logo folder), an accent color and a neutral footer instead of Immich's, in German or English. Name, color and
  logo can be changed in `.env`.

### 🧭 Planned

### 🧭 Possible later

- **Single sign-on** via OpenID Connect (e.g. Keycloak in front of LDAP) with group based roles.
- **Registration before downloads** in galleries (name, organization, intended use), stored in the audit log.
- **E-mail templates in the administration** – logo, colors, texts and subjects per e-mail type, with preview.

## Installation

ImagePier replaces only the Immich **server** container. Machine learning, PostgreSQL and Redis keep using the
official Immich images, and existing Immich data is used as it is.

> [!IMPORTANT]
> Use an ImagePier release that matches your current Immich version (e.g. `v3.4.2-ip.50` for Immich `v3.4.2`).
> Downgrading Immich is not supported. Always create a database backup before switching.

1. Start from a working [Immich Docker Compose installation](https://docs.immich.app/install/docker-compose).
2. Pin the Immich version and choose an ImagePier release in `.env`:

   ```bash
   IMMICH_VERSION=v3.4.2
   IMAGEPIER_VERSION=v3.4.2-ip.50
   IMAGEPIER_LANGUAGE=en   # language of usage rights tags and notifications: en, de
   # optional: e-mail and name of the media library account (created on first start)
   # IMAGEPIER_LIBRARY_EMAIL=media-library@imagepier.local
   # IMAGEPIER_LIBRARY_NAME=Media library
   # optional: look of the e-mails (default: embedded ImagePier logo; own logo as https URL of a PNG, not SVG)
   # IMAGEPIER_MAIL_NAME=ImagePier
   # IMAGEPIER_MAIL_COLOR=#6b46e5
   # IMAGEPIER_MAIL_LOGO_URL=https://photos.example.com/mail-logo.png
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

ImagePier does not change Immich's database tables. Remove `docker-compose.override.yml` and restart to return to
the official Immich server of the same version. Usage rights stay stored in Immich's asset metadata, and the
`Usage rights/…` tags and keywords remain as regular tags. Photos of areas stay in the area accounts – see
[DIFFERENCES.md](../DIFFERENCES.md#switching-back-to-immich).

## Releases and versions

| Tag | Meaning |
|---|---|
| `v3.4.2-ip.50` | ImagePier release 50 based on Immich `v3.4.2` |
| `release` | latest ImagePier release |
| `edge` | latest build of the `imagepier` branch – for testing only |

Images: `ghcr.io/pixxelhoff/imagepier-server`

## Development

See [IMAGEPIER.md](../IMAGEPIER.md) for the repository layout, how ImagePier stays updatable with new Immich
releases, the CI workflows and the code conventions.

## About

ImagePier is developed and maintained by **[pixxelhoff](https://github.com/pixxelhoff)**.
Questions, ideas or feedback: [contact@pixxelhoff.com](mailto:contact@pixxelhoff.com)

> [!TIP]
> **Made with vibe coding.** ImagePier was created by describing features in plain language and building them with
> AI-assisted development. Every change runs through Immich's complete test suite in CI and is tested in daily use
> before it is released – still, please review it like any other software before you rely on it.

## License

ImagePier is licensed under the [GNU Affero General Public License v3.0](../LICENSE), like Immich.
The complete source code of every published version is available in this repository.

Immich is a trademark of its respective owners. ImagePier is an independent project based on Immich's open source code.

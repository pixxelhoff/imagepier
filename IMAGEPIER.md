# ImagePier

**ImagePier** is a self-hosted media library for organizations.
It is based on [Immich](https://github.com/immich-app/immich) and adds features for use within an organization:

- **Usage rights per image** – photographer, copyright, license type, permitted usage, expiry date, credit line
- **Roles & shared library** – administrators, media managers per department, staff, external users
- **Website gallery** – embeddable albums for websites and content management systems with a download dialog showing usage rights and photo credits

ImagePier is **not an official Immich project** and is not supported by the Immich team.
Please report issues that only occur in ImagePier here – not to Immich.

## License

Like Immich, ImagePier is licensed under the **GNU Affero General Public License v3.0** (see `LICENSE`).
The complete source code of every running version is publicly available in this repository.

## Repository layout

| Branch / tag | Content |
|---|---|
| `main` | unmodified Immich (only synced, never edited) |
| `imagepier` | **default branch:** latest official Immich release + ImagePier changes |
| Tags `v3.4.2-ip.1`, … | ImagePier releases; the part before `-ip` is the underlying Immich version |

All ImagePier changes live as a small series of commits on top of an Immich release tag.
Custom code is kept in separate files and folders wherever possible (`imagepier/`, `server/src/imagepier/`, `web/src/lib/imagepier/`);
custom database tables use the prefix `imagepier_`.

## Features

### Usage rights

Each asset can carry usage rights: photographer, copyright holder, credit line, license type,
license source, permitted usage (internal, web, print, social media, press), expiry date and notes.

- Stored in Immich's asset metadata under the key `imagepier.usage-rights` – no own database tables.
- Suggested automatically after upload from embedded IPTC/XMP/EXIF fields (By-line, Creator, Artist,
  Copyright Notice, Rights, Copyright, Credit) and from file names such as `Harbour Festival (c) ACME, Jane Doe.jpg`.
  Suggestions are marked for review and never overwrite existing entries.
- Shown in the info panel of the asset viewer; the asset owner can edit them. Expired licenses are highlighted.
- Bulk editing: select several assets and choose "Edit usage rights" in the selection menu (next to "Change description").
  Only filled-in fields are applied; empty fields keep their current values.

- Search: the search dialog has an additional "Usage rights" tab to filter by photographer, copyright holder,
  license type and license status. To make this work with Immich's search, usage rights are mirrored into tags,
  e.g. `Usage rights/Photographer/Jane Doe` or `Usage rights/Status/Expiring soon`. These tags are maintained
  automatically – after editing, after metadata extraction and by a daily status check.
- Expiry: the daily status check (03:17 server time) marks licenses expiring within 30 days and expired licenses,
  and sends an in-app notification to the asset owner.
- Language of tag names and notifications: set `IMAGEPIER_LANGUAGE` (`en` default, `de`) in the server environment.

Code: `server/src/imagepier/`, `web/src/lib/imagepier/`.

## Updating to a new Immich release

```bash
imagepier/scripts/update-upstream.sh v3.5.0
```

The script fetches the new Immich release, rebases the ImagePier commits onto it and reports conflicts.
Afterwards: test, create the tag `v3.5.0-ip.1` and push it – the Docker image build starts automatically.

A weekly check (`.github/workflows/imagepier-upstream-check.yml`) reports early
when upcoming Immich changes conflict with ImagePier.

## Deployment

ImagePier only builds the server image. Machine learning, database and Redis keep using the official Immich images.
See `imagepier/deploy/docker-compose.override.yml` for an example.

The official Immich apps for iOS and Android keep working.

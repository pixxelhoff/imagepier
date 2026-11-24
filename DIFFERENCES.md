# ImagePier compared to Immich

ImagePier is based on [Immich](https://github.com/immich-app/immich). This page lists what behaves differently from a
standard Immich installation – for administrators who know Immich, and as a checklist when switching between the
two. Who may do what is described in [PERMISSIONS.md](PERMISSIONS.md); technical details are in
[IMAGEPIER.md](IMAGEPIER.md).

## Accounts, areas and access

| Topic | Immich | ImagePier |
|---|---|---|
| Roles | Administrator and user | Administrator, *Staff* and *External*, plus a level per area (view only, standard, editor, media manager) |
| Shared photos | Partner sharing between two people, albums | **Areas**: one technical account per area (*Area account*), shared automatically with everybody who has a level in it |
| Map | Own photos; partner photos optional | Own photos and the photos of all areas the user may view |
| Sidebar | Photos | *My photos*, *All photos* and one entry per area below *Photos*; *Trash of the areas* for editors |
| Upload | Everybody uploads to their own timeline | Uploads in the view of an area go directly into the area (level editor). Without upload permission the upload button and drag and drop are hidden |
| Editing photos of others | Not possible | Editors and media managers edit, trash and restore photos of their areas; externals only their own deliveries |
| Permanent deletion | Owner | Media library photos only by media managers of the area or administrators |
| Shared links | Owner and album members | Media library photos only of areas where the person sharing is at least *Editor* (staff) |
| Admin user list | Name and e-mail | Also role, search, role filter and sorting; area accounts are marked as *Area account* |
| Deleting a user | Deletes the user's files | Unchanged; photos moved into an area are moved to the folders of the area account first, so they are not affected |

## Metadata

| Topic | Immich | ImagePier |
|---|---|---|
| Usage rights | – | Photographer, copyright holder, credit line, license, channels (permitted / not permitted / under conditions, list configurable by administrators), expiry date, title and alternative text, scope of rights with additional checks, link to the rights document; suggested from IPTC/XMP/EXIF and file names; release status (in review, approved, approved with restrictions, blocked) decided by media managers; blocked photos cannot be downloaded, shared or published |
| Tags | Free tags per account, everybody creates their own | Immich tags still exist. In addition ImagePier maintains tags itself: `Usage rights/…` (derived from the usage rights) and the **keyword list** (see below) |
| Keywords | – | Administrators maintain a fixed keyword list (*Administration → Keywords*, pasted from a spreadsheet). Keywords are assigned in the panel *Keywords* of a photo or for a selection and stored as tags `Category/Keyword` of the account that owns the photo, so everybody with access finds the photo under the same keyword |
| Tag feature (tag page, tag panel, tag search) | Every user can switch it on in the account settings | Administrators only; everybody else works with the keyword list |
| Creating tags | Everybody | Once a keyword list exists, only administrators create tags; everybody else assigns keywords from the list. Keywords embedded in uploaded files are still read |
| Searching tags | Tags of the own account | Search tab *Keywords*: all selected keywords must apply, in own photos and all accessible areas at once. Immich's tag filter treats tags with the same name in different accounts as one tag |
| Tags when moving to an area | – (owners never change) | Tags of the photo are moved to the area account (same names) |
| Face recognition across areas | Each account has its own face group | The media library and all areas share one face group, so a person is recognized in every area; a name given in one area applies in all areas, and the people overview shows the people of all accessible areas |
| Storage usage and people when moving to an area | – (owners never change) | The storage usage moves to the area account; faces are recognized again in the area account |
| Downloads | Original file | Copy with photographer, copyright and usage terms written into IPTC/XMP/EXIF; the original stays unchanged |

## Additional functions

- **Website galleries** – public galleries of albums with approved usage rights for the gallery channels set by administrators, embeddable in a
  website, with their own look.
- **Audit log** – uploads, downloads, changes, trash and deletion, role and area changes (*Administration → Audit log*).
- **Import page** – *Import* in the sidebar for editors and media managers: checks a folder against the image
  guideline, renames the files by a scheme and uploads them with area, keywords and usage rights.
- **Trash of all areas** – *Administration → Trash* for administrators; *Trash of the areas* in the sidebar for editors
  and media managers.
- **Daily license check** – expiring and expired licenses are marked; owners are notified.

## Look and texts

| Topic | Immich | ImagePier |
|---|---|---|
| Name and logo | Immich | ImagePier (own logo can be mounted); Immich is credited in the *About* dialog |
| E-mails | Immich frame, logo, app store badges, English | ImagePier logo (embedded), accent color, neutral footer, German or English (`IMAGEPIER_LANGUAGE`) |
| Passkeys | Shown as "Immich" | Shown as "ImagePier" |
| Link previews (messengers) | Immich promo image for links without photos | ImagePier icon |
| *Support & feedback* | Official Immich resources | ImagePier links (`IMMICH_THIRD_PARTY_*`); the official Immich resources are hidden |

## What stays the same

- Timeline, albums, search, map, faces, memories, duplicates, jobs and all other Immich functions.
- The official Immich mobile apps. They show the areas a person has access to; ImagePier functions such as usage
  rights and keywords are available as tags.
- Machine learning, PostgreSQL and Redis use the official Immich images.
- Immich's database tables are not changed. ImagePier stores its data in Immich's asset metadata, tags and system
  metadata, adds the table `imagepier_audit` and creates one account per area.

## Switching back to Immich

Remove `docker-compose.override.yml` and restart with the official Immich server of the same version. Afterwards:

- Photos of areas stay in the area accounts. To work with them, sign in as area account (set a password first) or
  share the area accounts with partner sharing.
- Usage rights and keywords remain as regular tags; the usage rights panel, galleries and the audit log are gone.
- Restrictions for sharing, trash and deletion no longer apply.

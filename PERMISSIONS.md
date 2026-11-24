# ImagePier – roles and permissions

**English** · [Deutsch](PERMISSIONS.de.md)

This page explains who can do what in ImagePier. The short version is in the [README](.github/README.md).

## Concepts

- **Own photos** – photos someone uploaded to their own timeline. They are not restricted: their owner can view,
  edit, share, publish and delete them permanently, like in Immich.
- **Media library** – the official photos of the organization. They are split into **areas** (for example
  departments or projects). Each area belongs to a technical account (*Media library: &lt;area&gt;*); nobody signs in
  with these accounts.
- **Role** – set per account under *Administration → Users → user → Role and permissions*:
  - **Administrator** – full access to everything, including all areas and the administration.
  - **Staff** – employees. Access to the media library depends on their level per area.
  - **External** – for example photographers or agencies. Like staff, but limited to their own deliveries (see below).
- **Level per area** – staff and externals get one level for each area they need. Without a level, the area is not
  visible at all – not in the timeline, search, map or the mobile apps.

| Level | Meaning |
|---|---|
| **View only** | sees the area |
| **Standard** | sees and downloads |
| **Editor** | maintains the area: upload, usage rights, trash, sharing |
| **Media manager** | responsible for the area: also decides the release status and deletes permanently (staff only) |

Every area should have at least one media manager. *Administration → Areas* marks areas without one.

## Permission matrix (media library)

✅ allowed · ❌ not allowed · 👤 only for own deliveries (photos the person uploaded into the area)

| Action in an area | No level | View only | Standard | Editor (external) | Editor (staff) | Media manager | Administrator |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| See the area and its photos | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add photos to own albums | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download (with credits written into the file) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload into the area, assign own photos to it | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Enter usage rights | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Assign keywords from the keyword list | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Decide the release status (approve, restrict, block) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Download blocked photos | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit description and metadata | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Move to another area ¹ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Move to the trash and restore | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| See the trash of the area | ❌ | ❌ | ❌ | 👤 | ✅ | ✅ | ✅ |
| Delete permanently | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create shared links | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Publish in website galleries | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

¹ The person needs the level *Editor* or higher in both areas.

Administration (users, roles, areas, keyword list, channels, settings, the trash of all areas and the audit log) is for
administrators only. Everybody can assign keywords to their own photos. Once a keyword list exists, only
administrators create new tags. Immich's own tag feature (tag page, tag panel) is available to administrators only.

## Details

### Usage rights

- Every photo with usage rights has a **release status**: *In review*, *Approved*, *Approved with restrictions*
  (with a note on the restriction), *Blocked*. *Expired* is shown automatically once the expiry date has passed.
- Usage rights entered by editors are saved as **in review**. Only media managers of the area and administrators
  decide the release status; approvals are recorded in the audit log. Changes by editors put approved photos back
  to *in review*; blocked photos stay blocked.
- Owners decide the release status of their own photos.
- **Blocked** photos cannot be downloaded (except by media managers of the area and administrators), cannot be
  shared with new shared links, are not shown in existing shared links and never appear in website galleries.
- Website galleries only show *approved* photos with usage rights for web or press use that have not expired.

### External editors

Externals deliver photos into an area: they upload in the view of the area or assign their own photos to it.
ImagePier remembers who delivered each photo. Externals can only edit, trash and restore their own deliveries – in a
selection with other photos, the other photos are skipped. They cannot move photos between areas, share links or
publish galleries, and they cannot become media manager.

### Import

Editors and media managers find **Import** below the areas in the sidebar. It uploads a folder or many files into an
area they edit, with keywords and usage rights; externals can use it too. Media managers can set the release status,
for everybody else new photos are *in review*.

### Trash

- Editors and media managers find **Trash of the areas** below the areas in the sidebar. It lists the deleted photos
  of all areas where they are at least editor, with area, date and the person who deleted them, and can be filtered
  by area.
- Editors restore; only media managers delete permanently (with a confirmation).
- Externals only see their own deliveries there.
- Administrators see the trash of all areas under *Administration → Trash*.
- Photos stay in the trash for the period set in Immich (*Administration → Settings → Trash*) and are then deleted
  automatically.

### Sharing and website galleries

- A **shared link** may only contain media library photos of areas where the person creating it is at least
  *Editor* (staff). For an album link, all photos in the album are checked when the link is created. Own photos can
  always be shared.
- A **website gallery** only shows media library photos of areas where the person who published it is at least
  *Editor*, plus their own photos. Photos of other areas stay hidden, even if they are in the album.
- Known limitation: photos added to an album after an album link was created are not checked again.

### Mobile apps

The official Immich apps show the areas a person has a level in (through Immich's partner sharing). All permissions
are checked on the server, so the apps cannot do more than the web app.

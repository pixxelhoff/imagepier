import { getUsageRightsStatus } from 'src/imagepier/usage-rights-tags.js';
import { UsageRights } from 'src/imagepier/usage-rights.js';

/**
Public website galleries.

A gallery publishes one album under a random key. Only assets with approved usage rights that permit one of the
gallery channels (set by administrators, by default website and press) and that have not expired are shown; the
filter is applied on the server.
*/

export const GALLERY_SETTINGS_KEY = 'imagepier.galleries';

/** Assets are published if one of these channels is permitted (default without a stored channel list). */
export const GALLERY_USAGES: ReadonlySet<string> = new Set(['web', 'press']);

/** Size limit of the logo, stored as data URL. */
export const MAX_LOGO_LENGTH = 400_000;

export type Gallery = {
  id: string;
  key: string;
  albumId: string;
  title: string;
  allowDownload: boolean;
  createdById: string;
  createdAt: string;
  /** Appearance of this gallery; empty values use the default appearance. */
  branding?: GalleryBranding;
};

export type GalleryBranding = {
  title?: string;
  color?: string;
  logo?: string;
  footer?: string;
  imprintUrl?: string;
  privacyUrl?: string;
};

export type GallerySettings = { galleries: Gallery[]; branding: GalleryBranding };

const text = (value: unknown, maxLength: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;

const url = (value: unknown) => {
  const result = text(value, 500);
  return result && /^https?:\/\//i.test(result) ? result : undefined;
};

export const parseBranding = (value: unknown): GalleryBranding => {
  const record = (value ?? {}) as Record<string, unknown>;
  const color = text(record.color, 7);
  const logo = text(record.logo, MAX_LOGO_LENGTH);
  return {
    title: text(record.title, 100),
    color: color && /^#[\da-f]{6}$/i.test(color) ? color : undefined,
    logo: logo?.startsWith('data:image/') ? logo : undefined,
    footer: text(record.footer, 1000),
    imprintUrl: url(record.imprintUrl),
    privacyUrl: url(record.privacyUrl),
  };
};

export const parseGallerySettings = (value: unknown): GallerySettings => {
  const record = (value ?? {}) as Partial<GallerySettings>;
  const galleries = Array.isArray(record.galleries)
    ? record.galleries.filter(
        (gallery): gallery is Gallery =>
          !!gallery && typeof gallery.id === 'string' && typeof gallery.key === 'string' && !!gallery.albumId,
      )
    : [];
  return {
    galleries: galleries.map((gallery) => ({
      ...gallery,
      branding: gallery.branding ? parseBranding(gallery.branding) : undefined,
    })),
    branding: parseBranding(record.branding),
  };
};

const BRANDING_KEYS = ['title', 'color', 'logo', 'footer', 'imprintUrl', 'privacyUrl'] as const;

/** Appearance of a gallery: its own values, otherwise the default appearance. */
export const mergeBranding = (defaults: GalleryBranding, overrides: GalleryBranding = {}): GalleryBranding => {
  const result: GalleryBranding = {};
  for (const key of BRANDING_KEYS) {
    const value = overrides[key] ?? defaults[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

/** Parses a comma separated list of asset IDs; invalid entries are ignored. */
export const parseAssetIds = (value = '') => {
  const ids = value
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(id));
  return [...new Set(ids)];
};

/** File name of a ZIP archive, derived from the gallery title. */
export const getArchiveName = (title: string) => {
  const name = [...title]
    .filter((char) => (char.codePointAt(0) ?? 0) >= 32 && !String.raw`\/:*?"<>|`.includes(char))
    .join('')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${name || 'gallery'}.zip`;
};

/** Whether an asset with these usage rights may appear in a public gallery. */
export const isPublishable = (
  rights: UsageRights | undefined,
  today = new Date(),
  galleryChannels: ReadonlySet<string> = GALLERY_USAGES,
) =>
  !!rights &&
  rights.status === 'confirmed' &&
  (rights.permittedUsage ?? []).some((usage) => galleryChannels.has(usage)) &&
  getUsageRightsStatus(rights, today) !== 'expired';

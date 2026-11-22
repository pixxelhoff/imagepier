import { getUsageRightsStatus } from 'src/imagepier/usage-rights-tags.js';
import { UsageRights } from 'src/imagepier/usage-rights.js';

/**
Public website galleries.

A gallery publishes one album under a random key. Only assets with confirmed usage rights that permit
website or press use and that have not expired are shown; the filter is applied on the server.
*/

export const GALLERY_SETTINGS_KEY = 'imagepier.galleries';

/** Assets are published if one of these uses is permitted. */
export const GALLERY_USAGES = new Set(['web', 'press']);

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
  return { galleries, branding: parseBranding(record.branding) };
};

/** Whether an asset with these usage rights may appear in a public gallery. */
export const isPublishable = (rights: UsageRights | undefined, today = new Date()) =>
  !!rights &&
  rights.status === 'confirmed' &&
  (rights.permittedUsage ?? []).some((usage) => GALLERY_USAGES.has(usage)) &&
  getUsageRightsStatus(rights, today) !== 'expired';

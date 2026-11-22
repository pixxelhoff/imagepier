import { defaults } from '@immich/sdk';

/** Public website galleries; keep in sync with server/src/imagepier/gallery.ts. */

export type GalleryBranding = {
  title?: string;
  color?: string;
  logo?: string;
  footer?: string;
  imprintUrl?: string;
  privacyUrl?: string;
};

export type GalleryAsset = {
  id: string;
  fileName: string;
  width: number | null;
  height: number | null;
  creditLine: string | null;
  photographer: string | null;
  copyrightHolder: string | null;
  license: string | null;
  licenseSource: string | null;
  usages: string[];
  validUntil: string | null;
};

export type PublicGallery = {
  title: string;
  allowDownload: boolean;
  assets: GalleryAsset[];
  branding: GalleryBranding;
};

export type Gallery = {
  id: string;
  key: string;
  albumId: string;
  albumName: string | null;
  title: string;
  allowDownload: boolean;
  createdById: string;
  createdAt: string;
};

/** Size limit of the logo, stored as data URL. */
export const MAX_LOGO_LENGTH = 400_000;

const request = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${defaults.baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...defaults.headers },
  });
  if (!response.ok) {
    throw new Error(`ImagePier request failed: ${response.status} ${response.statusText}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

const galleryPath = (key: string) => `/imagepier/gallery/${encodeURIComponent(key)}`;

export const getPublicGallery = (key: string) => request<PublicGallery>(galleryPath(key));

export const getGalleryImageUrl = (key: string, assetId: string, size: 'thumbnail' | 'preview') =>
  `${defaults.baseUrl}${galleryPath(key)}/assets/${assetId}?size=${size}`;

export const getGalleryDownloadUrl = (key: string, assetId: string) =>
  `${defaults.baseUrl}${galleryPath(key)}/assets/${assetId}/download`;

/** Address of the public gallery page, for links on websites. */
export const getGalleryPageUrl = (key: string) => `${location.origin}/gallery/${key}`;

export const getGalleries = () => request<Gallery[]>('/imagepier/galleries');

export const createGallery = (dto: { albumId: string; title: string; allowDownload: boolean }) =>
  request<Gallery>('/imagepier/galleries', { method: 'POST', body: JSON.stringify(dto) });

export const deleteGallery = (id: string) => request<void>(`/imagepier/galleries/${id}`, { method: 'DELETE' });

export const getGalleryBranding = () => request<GalleryBranding>('/admin/imagepier/gallery/branding');

export const updateGalleryBranding = (branding: GalleryBranding) =>
  request<GalleryBranding>('/admin/imagepier/gallery/branding', { method: 'PUT', body: JSON.stringify(branding) });

/** Credit line of an asset; falls back to the copyright holder or photographer. */
export const getGalleryCredit = (asset: GalleryAsset) =>
  asset.creditLine ?? (asset.copyrightHolder ? `© ${asset.copyrightHolder}` : (asset.photographer ?? ''));

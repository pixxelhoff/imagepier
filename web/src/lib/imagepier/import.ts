import { request } from '#lib/imagepier/access.ts';
import { toCsv } from '#lib/imagepier/csv.ts';
import {
  applyChannels,
  applyChecks,
  toUsageRightsPatch,
  type UsageRights,
  type UsageRightsInput,
} from '#lib/imagepier/usage-rights.ts';
import { uploadRequest } from '#lib/utils.ts';
import { getBaseUrl, type AssetMediaResponseDto } from '@immich/sdk';

/** Rules of the image guideline for new images. */
export const MIN_LONG_EDGE = 3000;
export const MIN_YEAR = 2021;

/** Size and capture date read from the file; undefined if the format is not supported by the browser. */
export type ImageInfo = { width?: number; height?: number; takenAt?: Date };

export type ImportWarning = 'small' | 'old' | 'duplicate' | 'exists';

/** File of the import page that is already in ImagePier; `areaId` is null for the user's own photos. */
export type ImportMatch = { checksum: string; areaId: string | null; assetId?: string; trashed: boolean };

export type ImportDto = {
  assetIds: string[];
  areaId?: string;
  keywords?: string[];
  usageRights?: Record<string, unknown>;
};

/** Parts of the file name scheme `topic-subject-place-year-c-author-001`. */
export type FileNameParts = { topic: string; subject: string; place: string; author: string };

const EXIF_READ_BYTES = 1024 * 1024;

const readAscii = (view: DataView, offset: number, length: number) => {
  let text = '';
  for (let index = 0; index < length && offset + index < view.byteLength; index++) {
    const code = view.getUint8(offset + index);
    if (code === 0) {
      break;
    }
    text += String.fromCodePoint(code);
  }
  return text;
};

/** Parses an EXIF date (`2024:05:17 14:03:00`); invalid values are ignored. */
export const parseExifDate = (value: string) => {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return;
  }
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(date.getTime()) || year < 1900 ? undefined : date;
};

type IfdEntry = { tag: number; type: number; count: number; valueOffset: number };

const readIfd = (view: DataView, tiff: number, offset: number, little: boolean): IfdEntry[] => {
  const start = tiff + offset;
  if (start + 2 > view.byteLength) {
    return [];
  }
  const count = view.getUint16(start, little);
  const entries: IfdEntry[] = [];
  for (let index = 0; index < count; index++) {
    const entry = start + 2 + index * 12;
    if (entry + 12 > view.byteLength) {
      break;
    }
    entries.push({
      tag: view.getUint16(entry, little),
      type: view.getUint16(entry + 2, little),
      count: view.getUint32(entry + 4, little),
      valueOffset: entry + 8,
    });
  }
  return entries;
};

const readNumber = (view: DataView, entry: IfdEntry, little: boolean) =>
  entry.type === 3 ? view.getUint16(entry.valueOffset, little) : view.getUint32(entry.valueOffset, little);

/** Reads the capture date and the pixel size from the EXIF block of a JPEG file (APP1 segment). */
const readExif = (view: DataView, start: number): ImageInfo => {
  const tiff = start + 6;
  const little = view.getUint16(tiff) === 0x49_49;
  const ifd0 = view.getUint32(tiff + 4, little);
  const info: ImageInfo = {};
  let dateTime: string | undefined;

  for (const entry of readIfd(view, tiff, ifd0, little)) {
    if (entry.tag === 0x01_32) {
      dateTime = readAscii(view, tiff + view.getUint32(entry.valueOffset, little), entry.count);
    }
    if (entry.tag !== 0x87_69) {
      continue;
    }
    for (const sub of readIfd(view, tiff, view.getUint32(entry.valueOffset, little), little)) {
      switch (sub.tag) {
        case 0x90_03: {
          info.takenAt = parseExifDate(readAscii(view, tiff + view.getUint32(sub.valueOffset, little), sub.count));
          break;
        }
        case 0xa0_02: {
          info.width = readNumber(view, sub, little);
          break;
        }
        case 0xa0_03: {
          info.height = readNumber(view, sub, little);
          break;
        }
      }
    }
  }

  info.takenAt ??= dateTime ? parseExifDate(dateTime) : undefined;
  return info;
};

/** Reads the capture date and the pixel size of a JPEG file from its first megabyte. */
export const readJpegInfo = (buffer: ArrayBuffer): ImageInfo => {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xff_d8) {
    return {};
  }

  let info: ImageInfo = {};
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      break;
    }
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1 && readAscii(view, offset + 4, 4) === 'Exif') {
      try {
        info = { ...readExif(view, offset + 4), ...info };
      } catch {
        // Broken EXIF data: the size is still read from the frame header.
      }
    }
    // Start of frame (baseline, progressive …): the real pixel size of the image.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame && offset + 9 <= view.byteLength) {
      info.height = view.getUint16(offset + 5);
      info.width = view.getUint16(offset + 7);
      break;
    }
    if (marker === 0xda) {
      break;
    }
    offset += 2 + length;
  }
  return info;
};

/** Reads size and capture date of an image; JPEG files directly, other formats the browser can show via a bitmap. */
export const readImageInfo = async (file: File): Promise<ImageInfo> => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    const buffer = await file.slice(0, EXIF_READ_BYTES).arrayBuffer();
    return readJpegInfo(buffer);
  }

  if (!['image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    return {};
  }

  try {
    const bitmap = await createImageBitmap(file);
    const info = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return info;
  } catch {
    return {};
  }
};

/** Warnings of a file against the rules of the image guideline. */
export const getImportWarnings = (info: ImageInfo, duplicate: boolean, exists: boolean): ImportWarning[] => {
  const warnings: ImportWarning[] = [];
  if (info.width && info.height && Math.max(info.width, info.height) < MIN_LONG_EDGE) {
    warnings.push('small');
  }
  if (info.takenAt && info.takenAt.getFullYear() < MIN_YEAR) {
    warnings.push('old');
  }
  if (duplicate) {
    warnings.push('duplicate');
  }
  if (exists) {
    warnings.push('exists');
  }
  return warnings;
};

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Lower case, umlauts replaced, everything else than letters and digits becomes a hyphen. */
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[äöüß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^\da-z]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

const getExtension = (fileName: string) => {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot).toLowerCase() : '';
};

/**
File name by the scheme of the image guideline: `topic-subject-place-year-c-author-001.jpg`.
Empty parts are left out; the license is not part of the name.
*/
export const buildFileName = (parts: FileNameParts, year: number | undefined, index: number, original: string) => {
  const author = slugify(parts.author);
  const name = [
    slugify(parts.topic),
    slugify(parts.subject),
    slugify(parts.place),
    year ? String(year) : '',
    author ? `c-${author}` : '',
    String(index + 1).padStart(3, '0'),
  ]
    .filter((part) => part.length > 0)
    .join('-');
  return `${name}${getExtension(original)}`;
};

/** Usage rights from the dialog as stored fields (channels and checks resolved); empty fields are left out. */
export const toImportUsageRights = (input: UsageRightsInput): Record<string, unknown> => {
  const { channels, checkValues, ...patch } = toUsageRightsPatch(input);
  const rights: Partial<UsageRights> = applyChecks(applyChannels({ ...patch }, channels), checkValues);
  return Object.fromEntries(
    Object.entries(rights).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)),
  );
};

/** SHA-1 checksum of a file, computed in a worker like the regular upload. */
export const hashFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/hash-file.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', ({ data }: MessageEvent<{ result?: string; error?: string }>) => {
      worker.terminate();
      if (data.error || !data.result) {
        reject(new Error(data.error ?? 'No checksum'));
      } else {
        resolve(data.result);
      }
    });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(event.message));
    });
    worker.postMessage(file);
  });

export const checkImport = (checksums: string[]) =>
  request<ImportMatch[]>('/imagepier/import/check', { method: 'POST', body: JSON.stringify({ checksums }) });

export const importAssets = (dto: ImportDto) =>
  request<{ count: number }>('/imagepier/import', { method: 'POST', body: JSON.stringify(dto) });

/** Uploads one file with the regular upload endpoint under the given file name. */
export const uploadImportFile = async (file: File, fileName: string) => {
  const formData = new FormData();
  formData.append('fileCreatedAt', new Date(file.lastModified).toISOString());
  formData.append('fileModifiedAt', new Date(file.lastModified).toISOString());
  formData.append('isFavorite', 'false');
  formData.append('assetData', new File([file], fileName, { type: file.type }));
  const response = await uploadRequest<AssetMediaResponseDto>({ url: `${getBaseUrl()}/assets`, data: formData });
  return response.data;
};

/** Protocol of an import as CSV (semicolon separated, for Excel). */
export const toImportCsv = (header: string[], rows: string[][]) => toCsv([header, ...rows]);

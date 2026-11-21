/**
ImagePier usage rights.

Usage rights are stored per asset in Immich's generic asset metadata store
(table `asset_metadata`) under the key `USAGE_RIGHTS_KEY`. This keeps ImagePier
free of own database migrations and lets the existing, permission-checked
asset metadata endpoints handle reading and writing.
*/

export const USAGE_RIGHTS_KEY = 'imagepier.usage-rights';
export const USAGE_RIGHTS_VERSION = 1;

export const LICENSE_TYPES = ['owned', 'time-limited', 'agency', 'creative-commons', 'other'] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

export const PERMITTED_USAGES = ['internal', 'web', 'print', 'social', 'press'] as const;
export type PermittedUsage = (typeof PERMITTED_USAGES)[number];

export type UsageRightsStatus = 'suggested' | 'confirmed';
export type SuggestionSource = 'metadata' | 'filename';

export interface UsageRights {
  version: number;
  status: UsageRightsStatus;
  suggestedFrom?: SuggestionSource[];
  photographer?: string;
  copyrightHolder?: string;
  licenseType?: LicenseType;
  licenseSource?: string;
  permittedUsage?: PermittedUsage[];
  /** ISO date (YYYY-MM-DD) */
  validUntil?: string;
  creditLine?: string;
  notes?: string;
}

/** Prefix used when a credit line is generated automatically. */
export const CREDIT_LINE_PREFIX = 'Foto:';

const COPYRIGHT_MARKER = /\(c\)|©|\bcopyright\b/i;
const YEAR = /\b(19|20)\d{2}\b/g;

const asText = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

/** Validates a stored usage rights value; unknown fields and invalid entries are dropped. */
export const parseUsageRights = (value: Record<string, unknown>): UsageRights => {
  const permittedUsage = Array.isArray(value.permittedUsage)
    ? PERMITTED_USAGES.filter((usage) => (value.permittedUsage as unknown[]).includes(usage))
    : [];
  const validUntil = asText(value.validUntil);

  return {
    version: USAGE_RIGHTS_VERSION,
    status: value.status === 'confirmed' ? 'confirmed' : 'suggested',
    photographer: asText(value.photographer),
    copyrightHolder: asText(value.copyrightHolder),
    licenseType: LICENSE_TYPES.find((type) => type === value.licenseType),
    licenseSource: asText(value.licenseSource),
    permittedUsage: permittedUsage.length > 0 ? permittedUsage : undefined,
    validUntil: validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : undefined,
    creditLine: asText(value.creditLine),
    notes: asText(value.notes),
  };
};

/** Converts an exiftool value (string, number, list or language map) into trimmed text. */
export const toText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
  }

  if (Array.isArray(value)) {
    const parts = value.map((item) => toText(item)).filter((item): item is string => !!item);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return toText(record['x-default'] ?? Object.values(record)[0]);
  }

  return;
};

/** Removes copyright markers, years and separators, e.g. "© 2026 ACME" -> "ACME". */
export const cleanHolder = (value: string): string | undefined => {
  const cleaned = value
    .replaceAll(new RegExp(COPYRIGHT_MARKER.source, 'gi'), ' ')
    .replaceAll(YEAR, ' ')
    .replaceAll(/\ball rights reserved\b\.?/gi, ' ')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/^[\s,.:;/-]+|[\s,.:;/-]+$/g, '')
    .trim();

  return cleaned.length > 0 ? cleaned : undefined;
};

const isAbbreviation = (value: string) => /^[A-ZÄÖÜ0-9&-]{2,}$/.test(value);

/**
Splits the text after a copyright marker into holder and photographer.

- "ACME, Jane Doe" -> holder ACME, photographer Jane Doe
- "ACME John Smith"   -> holder ACME, photographer John Smith
- "ACME"                 -> holder ACME
- "Jane Doe"       -> holder and photographer Jane Doe
*/
export const splitCredit = (text: string): Pick<UsageRights, 'photographer' | 'copyrightHolder'> => {
  const value = cleanHolder(text);
  if (!value) {
    return {};
  }

  const parts = value
    .split(/\s*[,/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { copyrightHolder: parts[0], photographer: parts.at(-1) };
  }

  const words = value.split(' ');
  if (words.length >= 2 && isAbbreviation(words[0])) {
    return { copyrightHolder: words[0], photographer: words.slice(1).join(' ') };
  }

  if (isAbbreviation(value)) {
    return { copyrightHolder: value };
  }

  return { copyrightHolder: value, photographer: value };
};

/**
Reads holder and photographer from a file name like
"Harbour Festival 2026 (c) ACME, Jane Doe.jpg".
*/
export const parseFilename = (filename: string): Pick<UsageRights, 'photographer' | 'copyrightHolder'> => {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/~\d+$/, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replaceAll('_', ' ');

  const match = /(?:\(c\)|©)\s*(.+)$/i.exec(base);
  if (!match) {
    return {};
  }

  return splitCredit(match[1]);
};

/** Adds the credit prefix unless the text already starts with a photo/credit label. */
export const withCreditPrefix = (text: string) =>
  /^(foto|photo|bild|credit)s?\s*:/i.test(text) ? text : `${CREDIT_LINE_PREFIX} ${text}`;

export const buildCreditLine = ({
  photographer,
  copyrightHolder,
}: Pick<UsageRights, 'photographer' | 'copyrightHolder'>) => {
  if (photographer && copyrightHolder && photographer !== copyrightHolder) {
    return `${CREDIT_LINE_PREFIX} ${photographer} / ${copyrightHolder}`;
  }

  const name = photographer ?? copyrightHolder;
  return name ? `${CREDIT_LINE_PREFIX} ${name}` : undefined;
};

/**
Builds a usage rights suggestion from embedded metadata (IPTC/XMP/EXIF) and,
as a fallback, from the original file name. Returns undefined if nothing was found.
*/
export const suggestUsageRights = (tags: Record<string, unknown>, filename: string): UsageRights | undefined => {
  const suggestedFrom: SuggestionSource[] = [];

  const metadataPhotographer = toText(tags['By-line']) ?? toText(tags['Creator']) ?? toText(tags['Artist']);
  const metadataCopyright = toText(tags['CopyrightNotice']) ?? toText(tags['Rights']) ?? toText(tags['Copyright']);
  const metadataCredit = toText(tags['Credit']);

  let photographer = metadataPhotographer;
  let copyrightHolder = metadataCopyright ? cleanHolder(metadataCopyright) : undefined;

  if (photographer || copyrightHolder || metadataCredit) {
    suggestedFrom.push('metadata');
  }

  if (!photographer || !copyrightHolder) {
    const fromFilename = parseFilename(filename);
    if (fromFilename.photographer || fromFilename.copyrightHolder) {
      photographer ??= fromFilename.photographer;
      copyrightHolder ??= fromFilename.copyrightHolder;
      suggestedFrom.push('filename');
    }
  }

  if (suggestedFrom.length === 0) {
    return;
  }

  const creditLine = metadataCredit
    ? withCreditPrefix(metadataCredit)
    : buildCreditLine({ photographer, copyrightHolder });

  return {
    version: USAGE_RIGHTS_VERSION,
    status: 'suggested',
    suggestedFrom,
    ...(photographer && { photographer }),
    ...(copyrightHolder && { copyrightHolder }),
    ...(creditLine && { creditLine }),
  };
};

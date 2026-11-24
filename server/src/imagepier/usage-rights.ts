/**
ImagePier usage rights.

Usage rights are stored per asset in Immich's generic asset metadata store
(table `asset_metadata`) under the key `USAGE_RIGHTS_KEY`. This keeps ImagePier
free of own database migrations and lets the existing, permission-checked
asset metadata endpoints handle reading and writing.
*/

import { BadRequestException } from '@nestjs/common';

export const USAGE_RIGHTS_KEY = 'imagepier.usage-rights';
export const USAGE_RIGHTS_VERSION = 1;

export const LICENSE_TYPES = ['owned', 'time-limited', 'agency', 'creative-commons', 'other'] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

/** Channel ids (see channels.ts); the first five are the channels of earlier versions. */
export type PermittedUsage = string;

const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

const toChannelIds = (value: unknown, exclude: string[] = []) => {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && CHANNEL_ID.test(item))
    : [];
  const unique = [...new Set(ids)].filter((id) => !exclude.includes(id));
  return unique.length > 0 ? unique : undefined;
};

/**
Release status. The stored names are kept from earlier versions: `suggested` means "in review", `confirmed` means
"approved". `restricted` is approved with restrictions (see `restriction`); `blocked` assets cannot be downloaded,
shared or published. "Expired" is not stored, it follows from `validUntil`.
*/
export const RELEASE_STATUSES = ['suggested', 'confirmed', 'restricted', 'blocked'] as const;
export type UsageRightsStatus = (typeof RELEASE_STATUSES)[number];

/** Scope of the rights. */
export const TERRITORIES = ['worldwide', 'eu', 'germany', 'regional'] as const;
export type Territory = (typeof TERRITORIES)[number];
export const EDITING_OPTIONS = ['yes', 'crop', 'no'] as const;
export type Editing = (typeof EDITING_OPTIONS)[number];
export const TRANSFER_OPTIONS = ['yes', 'conditional', 'no'] as const;
export type Transfer = (typeof TRANSFER_OPTIONS)[number];

/**
Additional checks: an entry means the check applies to the asset; `cleared` means it has been clarified
(e.g. a model release exists).
*/
export const RIGHTS_CHECKS = ['people', 'minors', 'works', 'drone', 'property'] as const;
export type RightsCheck = (typeof RIGHTS_CHECKS)[number];
export type RightsCheckState = 'open' | 'cleared';
export type SuggestionSource = 'metadata' | 'filename';

export interface UsageRights {
  version: number;
  status: UsageRightsStatus;
  suggestedFrom?: SuggestionSource[];
  photographer?: string;
  copyrightHolder?: string;
  licenseType?: LicenseType;
  licenseSource?: string;
  /** Channels in which the asset may be used. */
  permittedUsage?: PermittedUsage[];
  /** Channels in which the asset may be used under conditions (see `usageNote`). */
  conditionalUsage?: PermittedUsage[];
  /** Conditions for the channels, e.g. "only with the logo of the partner". */
  usageNote?: string;
  /** ISO date (YYYY-MM-DD) */
  validUntil?: string;
  creditLine?: string;
  notes?: string;
  /** What the restriction of the status `restricted` is, e.g. "only print, not for advertising". */
  restriction?: string;
  /** Title and alternative text (accessibility), also written into downloads and used in galleries. */
  title?: string;
  altText?: string;
  /** Link or path to the contract, model release or other rights document. */
  rightsDocument?: string;
  territory?: Territory;
  /** Details of the territory, e.g. the region. */
  territoryNote?: string;
  editing?: Editing;
  transfer?: Transfer;
  exclusive?: boolean;
  checks?: Partial<Record<RightsCheck, RightsCheckState>>;
}

const parseChecks = (value: unknown) => {
  const record = (value ?? {}) as Record<string, unknown>;
  const checks = Object.fromEntries(
    RIGHTS_CHECKS.filter((check) => record[check] === 'open' || record[check] === 'cleared').map((check) => [
      check,
      record[check],
    ]),
  ) as Partial<Record<RightsCheck, RightsCheckState>>;
  return Object.keys(checks).length > 0 ? checks : undefined;
};

/** Prefix used when a credit line is generated automatically. */
export const CREDIT_LINE_PREFIX = 'Foto:';

const COPYRIGHT_MARKER = /\(c\)|©|\bcopyright\b/i;
const YEAR = /\b(19|20)\d{2}\b/g;

const asText = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

/** Validates a stored usage rights value; unknown fields and invalid entries are dropped. */
export const parseUsageRights = (value: Record<string, unknown>): UsageRights => {
  const permittedUsage = toChannelIds(value.permittedUsage);
  const validUntil = asText(value.validUntil);

  return {
    version: USAGE_RIGHTS_VERSION,
    status: RELEASE_STATUSES.find((status) => status === value.status) ?? 'suggested',
    photographer: asText(value.photographer),
    copyrightHolder: asText(value.copyrightHolder),
    licenseType: LICENSE_TYPES.find((type) => type === value.licenseType),
    licenseSource: asText(value.licenseSource),
    permittedUsage,
    conditionalUsage: toChannelIds(value.conditionalUsage, permittedUsage),
    usageNote: asText(value.usageNote),
    validUntil: validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : undefined,
    creditLine: asText(value.creditLine),
    notes: asText(value.notes),
    restriction: asText(value.restriction),
    title: asText(value.title),
    altText: asText(value.altText),
    rightsDocument: asText(value.rightsDocument),
    territory: TERRITORIES.find((item) => item === value.territory),
    territoryNote: asText(value.territoryNote),
    editing: EDITING_OPTIONS.find((item) => item === value.editing),
    transfer: TRANSFER_OPTIONS.find((item) => item === value.transfer),
    exclusive: typeof value.exclusive === 'boolean' ? value.exclusive : undefined,
    checks: parseChecks(value.checks),
  };
};

/**
Usage rights as they are stored: normalized like when read, without suggestion sources and empty fields. Throws for a
value that is not an object.
*/
export const toStoredUsageRights = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Invalid usage rights');
  }

  const rights = parseUsageRights({ ...(value as Record<string, unknown>), suggestedFrom: undefined });
  return Object.fromEntries(Object.entries(rights).filter(([, item]) => item !== undefined));
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

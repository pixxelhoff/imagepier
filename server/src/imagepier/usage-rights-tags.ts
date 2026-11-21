import { LICENSE_TYPES, LicenseType, PermittedUsage, UsageRights } from 'src/imagepier/usage-rights.js';

/**
Usage rights are mirrored into Immich tags so they can be used in Immich's search,
tag views and mobile apps, e.g. "Usage rights/Photographer/Jane Doe".
Notes are internal and therefore not mirrored.

The language of the tag names is configured with IMAGEPIER_LANGUAGE (en, de).
*/

export const USAGE_RIGHTS_STATUSES = ['valid', 'expiring', 'expired', 'unreviewed'] as const;
export type UsageRightsStatus = (typeof USAGE_RIGHTS_STATUSES)[number];

/** Licenses expiring within this number of days are marked as "expiring". */
export const EXPIRING_SOON_DAYS = 30;

/** Fields that are tagged as missing, so assets without them can be found and completed. */
export const MISSING_FIELDS = ['copyrightHolder', 'photographer', 'license'] as const;
export type MissingField = (typeof MISSING_FIELDS)[number];

export type TagLabels = {
  locale: string;
  root: string;
  photographer: string;
  copyrightHolder: string;
  license: string;
  status: string;
  usage: string;
  licenseSource: string;
  creditLine: string;
  validUntil: string;
  missing: string;
  missingFields: Record<MissingField, string>;
  licenses: Record<LicenseType, string>;
  statuses: Record<UsageRightsStatus, string>;
  usages: Record<PermittedUsage, string>;
  usageTerms: { license: string; usage: string; validUntil: string };
  notificationTitle: string;
  notificationExpiring: string;
  notificationExpired: string;
};

const labels: Record<string, TagLabels> = {
  en: {
    locale: 'en-CA',
    root: 'Usage rights',
    photographer: 'Photographer',
    copyrightHolder: 'Copyright holder',
    license: 'License',
    status: 'Status',
    usage: 'Permitted usage',
    licenseSource: 'License source',
    creditLine: 'Credit line',
    validUntil: 'Valid until',
    missing: 'Missing',
    missingFields: { copyrightHolder: 'Copyright holder', photographer: 'Photographer', license: 'License' },
    licenses: {
      owned: 'Owned by the organization',
      'time-limited': 'Time-limited',
      agency: 'Agency',
      'creative-commons': 'Creative Commons',
      other: 'Other',
    },
    statuses: { valid: 'Valid', expiring: 'Expiring soon', expired: 'Expired', unreviewed: 'Unreviewed' },
    usages: { internal: 'Internal', web: 'Website', print: 'Print', social: 'Social media', press: 'Press' },
    usageTerms: { license: 'License: {value}.', usage: 'Permitted use: {value}.', validUntil: 'Valid until {value}.' },
    notificationTitle: 'Usage rights',
    notificationExpiring: '{count} licenses expire within the next {days} days.',
    notificationExpired: '{count} licenses have expired.',
  },
  de: {
    locale: 'de-DE',
    root: 'Nutzungsrechte',
    photographer: 'Fotograf',
    copyrightHolder: 'Rechteinhaber',
    license: 'Lizenz',
    status: 'Status',
    usage: 'Erlaubte Nutzung',
    licenseSource: 'Lizenzquelle',
    creditLine: 'Bildnachweis',
    validUntil: 'Gültig bis',
    missing: 'Fehlende Angaben',
    missingFields: { copyrightHolder: 'Rechteinhaber', photographer: 'Fotograf', license: 'Lizenz' },
    licenses: {
      owned: 'Eigentum',
      'time-limited': 'Zeitlich begrenzt',
      agency: 'Agentur',
      'creative-commons': 'Creative Commons',
      other: 'Sonstige',
    },
    statuses: { valid: 'Gültig', expiring: 'Läuft bald ab', expired: 'Abgelaufen', unreviewed: 'Ungeprüft' },
    usages: { internal: 'Intern', web: 'Website', print: 'Print', social: 'Social Media', press: 'Presse' },
    usageTerms: { license: 'Lizenz: {value}.', usage: 'Erlaubte Nutzung: {value}.', validUntil: 'Gültig bis {value}.' },
    notificationTitle: 'Nutzungsrechte',
    notificationExpiring: '{count} Lizenzen laufen in den nächsten {days} Tagen ab.',
    notificationExpired: '{count} Lizenzen sind abgelaufen.',
  },
};

export const getTagLabels = (language = process.env.IMAGEPIER_LANGUAGE): TagLabels =>
  labels[(language ?? 'en').toLowerCase().split('-', 1)[0]] ?? labels.en;

export const formatMessage = (message: string, values: Record<string, string | number>) => {
  let result = message;
  for (const [name, value] of Object.entries(values)) {
    result = result.replaceAll(`{${name}}`, () => String(value));
  }
  return result;
};

/** Tag path segments must not contain the path separator. */
const segment = (value: string) => value.replaceAll('/', '-').trim();

export const getTagPaths = (tagLabels = getTagLabels()) => {
  const root = tagLabels.root;
  return {
    root,
    photographer: `${root}/${tagLabels.photographer}`,
    copyrightHolder: `${root}/${tagLabels.copyrightHolder}`,
    license: `${root}/${tagLabels.license}`,
    status: `${root}/${tagLabels.status}`,
    usage: `${root}/${tagLabels.usage}`,
    licenseSource: `${root}/${tagLabels.licenseSource}`,
    creditLine: `${root}/${tagLabels.creditLine}`,
    validUntil: `${root}/${tagLabels.validUntil}`,
    missing: `${root}/${tagLabels.missing}`,
  };
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export const getUsageRightsStatus = (rights: Pick<UsageRights, 'status' | 'validUntil'>, today = new Date()) => {
  if (rights.validUntil) {
    if (rights.validUntil < toIsoDate(today)) {
      return 'expired';
    }

    const soon = new Date(today);
    soon.setUTCDate(soon.getUTCDate() + EXPIRING_SOON_DAYS);
    if (rights.validUntil <= toIsoDate(soon)) {
      return 'expiring';
    }
  }

  return rights.status === 'confirmed' ? 'valid' : 'unreviewed';
};

/** Returns the tag values for fields that are not filled in yet. */
export const getMissingTagValues = (rights: UsageRights | undefined, tagLabels = getTagLabels()) => {
  const missingPath = getTagPaths(tagLabels).missing;
  const filled: Record<MissingField, boolean> = {
    copyrightHolder: !!rights?.copyrightHolder,
    photographer: !!rights?.photographer,
    license: !!rights?.licenseType,
  };
  return MISSING_FIELDS.filter((field) => !filled[field]).map(
    (field) => `${missingPath}/${tagLabels.missingFields[field]}`,
  );
};

/**
Returns the full tag values an asset should carry.
Assets without usage rights only get the tags for missing fields.
*/
export const getUsageRightsTagValues = (
  rights: UsageRights | undefined,
  today = new Date(),
  tagLabels = getTagLabels(),
) => {
  if (!rights) {
    return getMissingTagValues(rights, tagLabels);
  }

  const paths = getTagPaths(tagLabels);
  const values: string[] = [];

  const photographer = rights.photographer ? segment(rights.photographer) : '';
  if (photographer) {
    values.push(`${paths.photographer}/${photographer}`);
  }

  const copyrightHolder = rights.copyrightHolder ? segment(rights.copyrightHolder) : '';
  if (copyrightHolder) {
    values.push(`${paths.copyrightHolder}/${copyrightHolder}`);
  }

  const licenseType = LICENSE_TYPES.find((type) => type === rights.licenseType);
  if (licenseType) {
    values.push(`${paths.license}/${tagLabels.licenses[licenseType]}`);
  }

  for (const usage of rights.permittedUsage ?? []) {
    values.push(`${paths.usage}/${tagLabels.usages[usage]}`);
  }

  const licenseSource = rights.licenseSource ? segment(rights.licenseSource) : '';
  if (licenseSource) {
    values.push(`${paths.licenseSource}/${licenseSource}`);
  }

  const creditLine = rights.creditLine ? segment(rights.creditLine) : '';
  if (creditLine) {
    values.push(`${paths.creditLine}/${creditLine}`);
  }

  if (rights.validUntil) {
    values.push(`${paths.validUntil}/${rights.validUntil.slice(0, 4)}`);
  }

  values.push(
    `${paths.status}/${tagLabels.statuses[getUsageRightsStatus(rights, today)]}`,
    ...getMissingTagValues(rights, tagLabels),
  );

  return values;
};

/** Finds the status of an asset from its current tag values. */
export const getStatusFromTagValues = (values: string[], tagLabels = getTagLabels()) => {
  const prefix = `${getTagPaths(tagLabels).status}/`;
  const value = values.find((item) => item.startsWith(prefix));
  if (!value) {
    return;
  }

  const label = value.slice(prefix.length);
  return USAGE_RIGHTS_STATUSES.find((status) => tagLabels.statuses[status] === label);
};

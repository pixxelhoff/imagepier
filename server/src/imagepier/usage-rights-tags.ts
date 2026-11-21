import { LICENSE_TYPES, LicenseType, PermittedUsage, UsageRights } from 'src/imagepier/usage-rights.js';

/**
Usage rights are mirrored into Immich tags so they can be used in Immich's search,
tag views and mobile apps, e.g. "Usage rights/Photographer/Jane Doe".

The language of the tag names is configured with IMAGEPIER_LANGUAGE (en, de).
*/

export const USAGE_RIGHTS_STATUSES = ['valid', 'expiring', 'expired', 'unreviewed'] as const;
export type UsageRightsStatus = (typeof USAGE_RIGHTS_STATUSES)[number];

/** Licenses expiring within this number of days are marked as "expiring". */
export const EXPIRING_SOON_DAYS = 30;

export type TagLabels = {
  locale: string;
  root: string;
  photographer: string;
  copyrightHolder: string;
  license: string;
  status: string;
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

/** Returns the full tag values an asset with the given usage rights should carry. */
export const getUsageRightsTagValues = (rights: UsageRights, today = new Date(), tagLabels = getTagLabels()) => {
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

  values.push(`${paths.status}/${tagLabels.statuses[getUsageRightsStatus(rights, today)]}`);

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

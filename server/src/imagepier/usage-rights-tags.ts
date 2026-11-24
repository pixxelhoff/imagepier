import { LICENSE_TYPES, LicenseType, UsageRights } from 'src/imagepier/usage-rights.js';

/**
Usage rights are mirrored into Immich tags so they can be used in Immich's search,
tag views and mobile apps, e.g. "Usage rights/Photographer/Jane Doe".
Notes are internal and therefore not mirrored.

The language of the tag names is configured with IMAGEPIER_LANGUAGE (en, de).
*/

/** Status shown in the tags: the release status, unless the license expires soon or has expired. */
export const USAGE_RIGHTS_STATUSES = ['valid', 'restricted', 'expiring', 'expired', 'blocked', 'unreviewed'] as const;
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
  conditionalUsage: string;
  licenseSource: string;
  creditLine: string;
  validUntil: string;
  missing: string;
  area: string;
  missingFields: Record<MissingField, string>;
  licenses: Record<LicenseType, string>;
  statuses: Record<UsageRightsStatus, string>;
  /** Status labels of earlier versions; assets with these tags are moved to the current labels. */
  legacyStatuses: Partial<Record<UsageRightsStatus, string>>;
  /** Default channels and their names (see channels.ts). */
  usages: Record<string, string>;
  usageTerms: { license: string; usage: string; conditionalUsage: string; validUntil: string };
  /** Error messages shown in the web app (the server answers in the configured language). */
  errors: { shareForbidden: string; shareBlocked: string };
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
    conditionalUsage: 'Conditionally permitted',
    licenseSource: 'License source',
    creditLine: 'Credit line',
    validUntil: 'Valid until',
    missing: 'Missing',
    area: 'Area',
    missingFields: { copyrightHolder: 'Copyright holder', photographer: 'Photographer', license: 'License' },
    licenses: {
      owned: 'Owned by the organization',
      'time-limited': 'Time-limited',
      agency: 'Agency',
      'creative-commons': 'Creative Commons',
      other: 'Other',
    },
    statuses: {
      valid: 'Approved',
      restricted: 'Approved with restrictions',
      expiring: 'Expiring soon',
      expired: 'Expired',
      blocked: 'Blocked',
      unreviewed: 'In review',
    },
    legacyStatuses: { valid: 'Valid', unreviewed: 'Unreviewed' },
    usages: {
      internal: 'Internal',
      web: 'Website',
      print: 'Print',
      social: 'Social media',
      press: 'Press',
      'social-ads': 'Social ads',
      presentations: 'Presentations',
      partners: 'Partners and third parties',
      'paid-campaigns': 'Paid campaigns',
    },
    usageTerms: {
      license: 'License: {value}.',
      usage: 'Permitted use: {value}.',
      conditionalUsage: 'Permitted under conditions: {value}.',
      validUntil: 'Valid until {value}.',
    },
    errors: {
      shareForbidden: 'Media library assets can only be shared by editors and media managers of their areas',
      shareBlocked: 'Blocked assets cannot be shared',
    },
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
    conditionalUsage: 'Bedingt erlaubt',
    licenseSource: 'Lizenzquelle',
    creditLine: 'Bildnachweis',
    validUntil: 'Gültig bis',
    missing: 'Fehlende Angaben',
    area: 'Bereich',
    missingFields: { copyrightHolder: 'Rechteinhaber', photographer: 'Fotograf', license: 'Lizenz' },
    licenses: {
      owned: 'Eigentum',
      'time-limited': 'Zeitlich begrenzt',
      agency: 'Agentur',
      'creative-commons': 'Creative Commons',
      other: 'Sonstige',
    },
    statuses: {
      valid: 'Freigegeben',
      restricted: 'Freigegeben mit Einschränkung',
      expiring: 'Läuft bald ab',
      expired: 'Abgelaufen',
      blocked: 'Gesperrt',
      unreviewed: 'In Prüfung',
    },
    legacyStatuses: { valid: 'Gültig', unreviewed: 'Ungeprüft' },
    usages: {
      internal: 'Intern',
      web: 'Website',
      print: 'Print',
      social: 'Social Media',
      press: 'Presse',
      'social-ads': 'Social Ads',
      presentations: 'Präsentationen',
      partners: 'Partner und Dritte',
      'paid-campaigns': 'Bezahlte Kampagnen',
    },
    usageTerms: {
      license: 'Lizenz: {value}.',
      usage: 'Erlaubte Nutzung: {value}.',
      conditionalUsage: 'Unter Bedingungen erlaubt: {value}.',
      validUntil: 'Gültig bis {value}.',
    },
    errors: {
      shareForbidden: 'Bilder der Mediathek können nur Bearbeiter und Medienverantwortliche ihres Bereichs teilen',
      shareBlocked: 'Gesperrte Bilder können nicht geteilt werden',
    },
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
    area: `${root}/${tagLabels.area}`,
  };
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export const getUsageRightsStatus = (
  rights: Pick<UsageRights, 'status' | 'validUntil'>,
  today = new Date(),
): UsageRightsStatus => {
  if (rights.status === 'blocked') {
    return 'blocked';
  }

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

  if (rights.status === 'confirmed') {
    return 'valid';
  }

  return rights.status === 'restricted' ? 'restricted' : 'unreviewed';
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
Assets without usage rights only get the tags for missing fields (and their area).
*/
export const getUsageRightsTagValues = (
  rights: UsageRights | undefined,
  today = new Date(),
  tagLabels = getTagLabels(),
  areaName?: string,
  channelLabel: (id: string) => string = (id) => tagLabels.usages[id] ?? id,
) => {
  const paths = getTagPaths(tagLabels);
  const areaValues = areaName ? [`${paths.area}/${segment(areaName)}`] : [];
  if (!rights) {
    return [...getMissingTagValues(rights, tagLabels), ...areaValues];
  }

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
    values.push(`${paths.usage}/${segment(channelLabel(usage))}`);
  }

  for (const usage of rights.conditionalUsage ?? []) {
    values.push(`${paths.root}/${tagLabels.conditionalUsage}/${segment(channelLabel(usage))}`);
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
    ...areaValues,
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
  return USAGE_RIGHTS_STATUSES.find(
    (status) => tagLabels.statuses[status] === label || tagLabels.legacyStatuses[status] === label,
  );
};

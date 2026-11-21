import { locale } from 'svelte-i18n';
import { derived } from 'svelte/store';

/**
ImagePier translations.

Kept separate from Immich's i18n files so that Immich translation updates
never conflict with ImagePier strings. English is the fallback language.
*/
const en = {
  usage_rights: 'Usage rights',
  usage_rights_none: 'No usage rights recorded',
  usage_rights_add: 'Add usage rights',
  usage_rights_edit: 'Edit usage rights',
  usage_rights_saved: 'Usage rights saved',
  usage_rights_save_failed: 'Unable to save usage rights',
  usage_rights_load_failed: 'Unable to load usage rights',
  usage_rights_suggested: 'Suggested automatically – please review',
  usage_rights_expired: 'License expired',
  photographer: 'Photographer',
  copyright_holder: 'Copyright holder',
  license_type: 'License type',
  license_source: 'License source / contract',
  permitted_usage: 'Permitted usage',
  valid_until: 'Valid until',
  valid_until_unlimited: 'Unlimited',
  credit_line: 'Credit line',
  credit_line_placeholder: 'Photo: Name / Organization',
  credit_line_copy: 'Copy credit line',
  credit_line_copied: 'Credit line copied',
  notes: 'Notes',
  not_specified: 'Not specified',
  clear_date: 'Remove date',
  'license.owned': 'Owned by the organization',
  'license.time-limited': 'Time-limited usage right',
  'license.agency': 'Agency / stock',
  'license.creative-commons': 'Creative Commons',
  'license.other': 'Other',
  'usage.internal': 'Internal',
  'usage.web': 'Web',
  'usage.print': 'Print',
  'usage.social': 'Social media',
  'usage.press': 'Press',
};

export type ImagePierMessageKey = keyof typeof en;

const de: Record<ImagePierMessageKey, string> = {
  usage_rights: 'Nutzungsrechte',
  usage_rights_none: 'Keine Nutzungsrechte hinterlegt',
  usage_rights_add: 'Nutzungsrechte hinzufügen',
  usage_rights_edit: 'Nutzungsrechte bearbeiten',
  usage_rights_saved: 'Nutzungsrechte gespeichert',
  usage_rights_save_failed: 'Nutzungsrechte konnten nicht gespeichert werden',
  usage_rights_load_failed: 'Nutzungsrechte konnten nicht geladen werden',
  usage_rights_suggested: 'Automatisch vorgeschlagen – bitte prüfen',
  usage_rights_expired: 'Lizenz abgelaufen',
  photographer: 'Fotograf/in',
  copyright_holder: 'Rechteinhaber/in',
  license_type: 'Lizenzart',
  license_source: 'Lizenzquelle / Vertrag',
  permitted_usage: 'Erlaubte Nutzung',
  valid_until: 'Gültig bis',
  valid_until_unlimited: 'Unbegrenzt',
  credit_line: 'Bildnachweis',
  credit_line_placeholder: 'Foto: Name / Organisation',
  credit_line_copy: 'Bildnachweis kopieren',
  credit_line_copied: 'Bildnachweis kopiert',
  notes: 'Bemerkung',
  not_specified: 'Nicht angegeben',
  clear_date: 'Datum entfernen',
  'license.owned': 'Eigentum des Unternehmens',
  'license.time-limited': 'Zeitlich begrenztes Nutzungsrecht',
  'license.agency': 'Agentur / Stock',
  'license.creative-commons': 'Creative Commons',
  'license.other': 'Sonstige',
  'usage.internal': 'Intern',
  'usage.web': 'Web',
  'usage.print': 'Print',
  'usage.social': 'Social Media',
  'usage.press': 'Presse',
};

const messages: Record<string, Record<ImagePierMessageKey, string>> = { en, de };

/** Usage in components: `$ipt('usage_rights')` */
export const ipt = derived(locale, ($locale) => {
  const language = ($locale ?? 'en').toLowerCase().split('-', 1)[0];
  const dictionary = messages[language] ?? en;
  return (key: ImagePierMessageKey) => dictionary[key] ?? en[key];
});

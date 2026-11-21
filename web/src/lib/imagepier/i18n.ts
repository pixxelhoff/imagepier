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
  usage_rights_bulk_title: 'Set usage rights for {count} items',
  usage_rights_bulk_hint: 'Only filled-in fields are applied. Empty fields keep their current values.',
  usage_rights_bulk_saved: 'Usage rights updated for {count} items',
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
  any: 'Any',
  status: 'Status',
  search_usage_rights_description: 'Find assets by their usage rights, or assets where information is still missing.',
  search_usage_rights_untagged: 'Not available while searching for untagged assets.',
  search_usage_rights_usage_hint: 'Shows assets that are permitted for all selected uses.',
  missing_fields: 'Missing information',
  based_on_immich: 'ImagePier {version}, based on Immich',
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
  usage_rights_bulk_title: 'Nutzungsrechte für {count} Elemente festlegen',
  usage_rights_bulk_hint: 'Nur ausgefüllte Felder werden übernommen. Leere Felder behalten ihren bisherigen Wert.',
  usage_rights_bulk_saved: 'Nutzungsrechte für {count} Elemente aktualisiert',
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
  any: 'Alle',
  status: 'Status',
  search_usage_rights_description: 'Finde Bilder nach Nutzungsrechten oder mit fehlenden Angaben.',
  search_usage_rights_untagged: 'Nicht verfügbar, solange nach Bildern ohne Tags gesucht wird.',
  search_usage_rights_usage_hint: 'Zeigt Bilder, die für alle gewählten Nutzungen freigegeben sind.',
  missing_fields: 'Fehlende Angaben',
  based_on_immich: 'ImagePier {version}, basiert auf Immich',
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

/** Usage in components: `$ipt('usage_rights')` or `$ipt('usage_rights_bulk_title', { count: 3 })` */
export const ipt = derived(locale, ($locale) => {
  const language = ($locale ?? 'en').toLowerCase().split('-', 1)[0];
  const dictionary = messages[language] ?? en;
  return (key: ImagePierMessageKey, values: Record<string, string | number> = {}) => {
    let message = dictionary[key] ?? en[key];
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll(`{${name}}`, () => String(value));
    }
    return message;
  };
});

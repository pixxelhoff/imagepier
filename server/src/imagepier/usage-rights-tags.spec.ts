import {
  formatMessage,
  getStatusFromTagValues,
  getTagLabels,
  getUsageRightsStatus,
  getUsageRightsTagValues,
} from 'src/imagepier/usage-rights-tags.js';
import { USAGE_RIGHTS_VERSION, UsageRights } from 'src/imagepier/usage-rights.js';

const today = new Date('2026-06-01T12:00:00Z');

describe('usage rights tags', () => {
  describe('getTagLabels', () => {
    it('should default to English', () => {
      expect(getTagLabels('').root).toBe('Usage rights');
      expect(getTagLabels('xx').root).toBe('Usage rights');
    });

    it('should support German', () => {
      expect(getTagLabels('de').root).toBe('Nutzungsrechte');
      expect(getTagLabels('de-DE').root).toBe('Nutzungsrechte');
    });
  });

  describe('getUsageRightsStatus', () => {
    it('should detect expired licenses', () => {
      expect(getUsageRightsStatus({ status: 'confirmed', validUntil: '2026-05-31' }, today)).toBe('expired');
    });

    it('should detect licenses that expire soon', () => {
      expect(getUsageRightsStatus({ status: 'confirmed', validUntil: '2026-06-01' }, today)).toBe('expiring');
      expect(getUsageRightsStatus({ status: 'confirmed', validUntil: '2026-07-01' }, today)).toBe('expiring');
    });

    it('should treat later or missing dates as valid once confirmed', () => {
      expect(getUsageRightsStatus({ status: 'confirmed', validUntil: '2026-07-02' }, today)).toBe('valid');
      expect(getUsageRightsStatus({ status: 'confirmed' }, today)).toBe('valid');
      expect(getUsageRightsStatus({ status: 'suggested' }, today)).toBe('unreviewed');
    });

    it('should show restricted and blocked usage rights', () => {
      expect(getUsageRightsStatus({ status: 'restricted' }, today)).toBe('restricted');
      expect(getUsageRightsStatus({ status: 'blocked', validUntil: '2026-05-31' }, today)).toBe('blocked');
    });
  });

  describe('getUsageRightsTagValues', () => {
    it('should build tag values', () => {
      const rights: UsageRights = {
        version: USAGE_RIGHTS_VERSION,
        status: 'confirmed',
        photographer: 'Jane Doe',
        copyrightHolder: 'ACME / Media',
        licenseType: 'agency',
        validUntil: '2026-05-01',
      };

      expect(getUsageRightsTagValues(rights, today, getTagLabels('en'))).toEqual([
        'Usage rights/Photographer/Jane Doe',
        'Usage rights/Copyright holder/ACME - Media',
        'Usage rights/License/Agency',
        'Usage rights/Valid until/2026',
        'Usage rights/Status/Expired',
      ]);
    });

    it('should add usage, license source and credit line tags', () => {
      const rights: UsageRights = {
        version: USAGE_RIGHTS_VERSION,
        status: 'confirmed',
        permittedUsage: ['web', 'press'],
        conditionalUsage: ['social-ads'],
        licenseSource: 'Contract 2026/12',
        creditLine: 'Foto: Jane Doe / ACME',
        validUntil: '2027-12-31',
        notes: 'Internal note',
      };

      expect(getUsageRightsTagValues(rights, today, getTagLabels('de'))).toEqual([
        'Nutzungsrechte/Erlaubte Nutzung/Website',
        'Nutzungsrechte/Erlaubte Nutzung/Presse',
        'Nutzungsrechte/Bedingt erlaubt/Social Ads',
        'Nutzungsrechte/Lizenzquelle/Contract 2026-12',
        'Nutzungsrechte/Bildnachweis/Foto: Jane Doe - ACME',
        'Nutzungsrechte/Gültig bis/2027',
        'Nutzungsrechte/Status/Freigegeben',
        'Nutzungsrechte/Fehlende Angaben/Rechteinhaber',
        'Nutzungsrechte/Fehlende Angaben/Fotograf',
        'Nutzungsrechte/Fehlende Angaben/Lizenz',
      ]);
    });

    it('should always add a status tag', () => {
      const rights: UsageRights = { version: USAGE_RIGHTS_VERSION, status: 'suggested' };

      expect(getUsageRightsTagValues(rights, today, getTagLabels('de'))).toEqual([
        'Nutzungsrechte/Status/In Prüfung',
        'Nutzungsrechte/Fehlende Angaben/Rechteinhaber',
        'Nutzungsrechte/Fehlende Angaben/Fotograf',
        'Nutzungsrechte/Fehlende Angaben/Lizenz',
      ]);
    });

    it('should add the area of media library assets', () => {
      expect(getUsageRightsTagValues(undefined, today, getTagLabels('de'), 'Marketing / PR')).toEqual([
        'Nutzungsrechte/Fehlende Angaben/Rechteinhaber',
        'Nutzungsrechte/Fehlende Angaben/Fotograf',
        'Nutzungsrechte/Fehlende Angaben/Lizenz',
        'Nutzungsrechte/Bereich/Marketing - PR',
      ]);
    });

    it('should only add missing field tags without usage rights', () => {
      expect(getUsageRightsTagValues(undefined, today, getTagLabels('en'))).toEqual([
        'Usage rights/Missing/Copyright holder',
        'Usage rights/Missing/Photographer',
        'Usage rights/Missing/License',
      ]);
    });
  });

  describe('getStatusFromTagValues', () => {
    it('should read the status from tag values', () => {
      const labels = getTagLabels('en');
      expect(getStatusFromTagValues(['Usage rights/Status/Expiring soon'], labels)).toBe('expiring');
      expect(getStatusFromTagValues(['Usage rights/Photographer/Jane Doe'], labels)).toBeUndefined();
    });
  });

  describe('formatMessage', () => {
    it('should replace placeholders', () => {
      expect(formatMessage('{count} licenses in {days} days', { count: 3, days: 30 })).toBe('3 licenses in 30 days');
    });
  });
});

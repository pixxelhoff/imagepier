import {
  USAGE_RIGHTS_VERSION,
  buildCreditLine,
  cleanHolder,
  parseFilename,
  parseUsageRights,
  suggestUsageRights,
  toText,
} from 'src/imagepier/usage-rights.js';

describe('usage rights', () => {
  describe('parseUsageRights', () => {
    it('should only keep dates that exist', () => {
      expect(parseUsageRights({ validUntil: '2027-12-31' }).validUntil).toBe('2027-12-31');
      expect(parseUsageRights({ validUntil: '2028-02-29' }).validUntil).toBe('2028-02-29');
      expect(parseUsageRights({ validUntil: '2027-02-30' }).validUntil).toBeUndefined();
      expect(parseUsageRights({ validUntil: '2027-13-45' }).validUntil).toBeUndefined();
      expect(parseUsageRights({ validUntil: '31.12.2027' }).validUntil).toBeUndefined();
    });

    it('should keep the scope of rights and drop invalid values', () => {
      const rights = parseUsageRights({
        status: 'confirmed',
        title: ' Harbour ',
        territory: 'eu',
        editing: 'crop',
        transfer: 'anything',
        exclusive: false,
        checks: { people: 'cleared', drone: 'open', minors: 'maybe' },
        rightsDocument: 'https://example.com/contract.pdf',
      });

      expect(rights).toMatchObject({
        title: 'Harbour',
        territory: 'eu',
        editing: 'crop',
        exclusive: false,
        checks: { people: 'cleared', drone: 'open' },
        rightsDocument: 'https://example.com/contract.pdf',
      });
      expect(rights.transfer).toBeUndefined();
    });
  });

  describe('toText', () => {
    it('should handle strings, numbers, lists and language maps', () => {
      expect(toText('  Jane Doe ')).toBe('Jane Doe');
      expect(toText(2026)).toBe('2026');
      expect(toText(['Jane Doe', 'John Smith'])).toBe('Jane Doe, John Smith');
      expect(toText({ 'x-default': 'ACME' })).toBe('ACME');
      expect(toText(' '.repeat(3))).toBeUndefined();
      expect(toText(null)).toBeUndefined();
    });
  });

  describe('cleanHolder', () => {
    it('should remove copyright markers and years', () => {
      expect(cleanHolder('© 2026 ACME')).toBe('ACME');
      expect(cleanHolder('Copyright ACME. All rights reserved.')).toBe('ACME');
      expect(cleanHolder('(c) 2025 Jane Doe')).toBe('Jane Doe');
      expect(cleanHolder('©')).toBeUndefined();
    });
  });

  describe('parseFilename', () => {
    it.each([
      ['Harbour Festival 2026 (c) ACME, Jane Doe.jpg', { copyrightHolder: 'ACME', photographer: 'Jane Doe' }],
      ['Captain_Portrait (c) ACME John Smith.JPG', { copyrightHolder: 'ACME', photographer: 'John Smith' }],
      ['City View 2026 (c) Jane Doe.jpg', { copyrightHolder: 'Jane Doe', photographer: 'Jane Doe' }],
      ['Street Cleaning, Festival 2026 (c) ACME (3).jpeg', { copyrightHolder: 'ACME' }],
      ['Sunset © ACME.jpg', { copyrightHolder: 'ACME' }],
      ['Welcome_Event_jd~2.jpg', {}],
      ['IMG_0001.HEIC', {}],
    ])('should parse %s', (filename, expected) => {
      expect(parseFilename(filename)).toEqual(expected);
    });
  });

  describe('buildCreditLine', () => {
    it('should combine photographer and holder', () => {
      expect(buildCreditLine({ photographer: 'Jane Doe', copyrightHolder: 'ACME' })).toBe('Foto: Jane Doe / ACME');
      expect(buildCreditLine({ photographer: 'Jane Doe', copyrightHolder: 'Jane Doe' })).toBe('Foto: Jane Doe');
      expect(buildCreditLine({ copyrightHolder: 'ACME' })).toBe('Foto: ACME');
      expect(buildCreditLine({})).toBeUndefined();
    });
  });

  describe('suggestUsageRights', () => {
    it('should prefer embedded metadata', () => {
      expect(suggestUsageRights({ Artist: 'Jane Doe', Copyright: '© 2026 ACME' }, 'photo.jpg')).toEqual({
        version: USAGE_RIGHTS_VERSION,
        status: 'suggested',
        suggestedFrom: ['metadata'],
        photographer: 'Jane Doe',
        copyrightHolder: 'ACME',
        creditLine: 'Foto: Jane Doe / ACME',
      });
    });

    it('should use IPTC credit as credit line', () => {
      expect(suggestUsageRights({ 'By-line': 'John Smith', Credit: 'Foto: ACME' }, 'photo.jpg')).toMatchObject({
        photographer: 'John Smith',
        creditLine: 'Foto: ACME',
      });
    });

    it('should fill missing fields from the file name', () => {
      expect(suggestUsageRights({ Rights: { 'x-default': 'Copyright ACME' } }, 'City View (c) Jane Doe.jpg')).toEqual({
        version: USAGE_RIGHTS_VERSION,
        status: 'suggested',
        suggestedFrom: ['metadata', 'filename'],
        photographer: 'Jane Doe',
        copyrightHolder: 'ACME',
        creditLine: 'Foto: Jane Doe / ACME',
      });
    });

    it('should return undefined when nothing is found', () => {
      expect(suggestUsageRights({}, 'IMG_0001.jpg')).toBeUndefined();
    });
  });
});

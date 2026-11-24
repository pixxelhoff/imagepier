import {
  buildFileName,
  getImportWarnings,
  parseExifDate,
  readJpegInfo,
  slugify,
  toImportCsv,
} from '#lib/imagepier/import.ts';

describe('slugify', () => {
  it('should replace umlauts and separators', () => {
    expect(slugify('Strand mit Hund')).toBe('strand-mit-hund');
    expect(slugify(' Müritz – Größe ')).toBe('mueritz-groesse');
    expect(slugify('Café')).toBe('cafe');
  });
});

describe('buildFileName', () => {
  it('should build the name by the scheme and keep the extension', () => {
    const parts = { topic: 'Urlaub', subject: 'Strand mit Hund', place: '', author: 'Birgit Döring' };
    expect(buildFileName(parts, 2026, 0, 'IMG_1234.JPG')).toBe('urlaub-strand-mit-hund-2026-c-birgit-doering-001.jpg');
  });

  it('should leave out empty parts', () => {
    expect(buildFileName({ topic: '', subject: '', place: '', author: '' }, undefined, 41, 'a.png')).toBe('042.png');
  });
});

describe('parseExifDate', () => {
  it('should parse EXIF dates', () => {
    expect(parseExifDate('2024:05:17 14:03:00')?.getFullYear()).toBe(2024);
    expect(parseExifDate('0000:00:00 00:00:00')).toBeUndefined();
    expect(parseExifDate('')).toBeUndefined();
  });
});

describe('getImportWarnings', () => {
  it('should report the rules of the image guideline', () => {
    const info = { width: 2000, height: 1500, takenAt: new Date(2019, 0, 1) };
    expect(getImportWarnings(info, true, true)).toEqual(['small', 'old', 'duplicate', 'exists']);
    expect(getImportWarnings({ width: 6000, height: 4000 }, false, false)).toEqual([]);
    expect(getImportWarnings({}, false, false)).toEqual([]);
  });
});

describe('readJpegInfo', () => {
  it('should read the size from the frame header', () => {
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x0f, 0xa0, 0x17, 0x70, 0x03,
    ]);
    expect(readJpegInfo(bytes.buffer)).toEqual({ height: 4000, width: 6000 });
  });

  it('should ignore other files', () => {
    expect(readJpegInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toEqual({});
  });
});

describe('toImportCsv', () => {
  it('should quote all cells', () => {
    expect(toImportCsv(['a', 'b'], [['x "y"', 'z']])).toBe('"a";"b"\r\n"x ""y""";"z"');
  });
});

import { formatMessage } from '#lib/imagepier/i18n.ts';

describe('formatMessage', () => {
  it('should insert values', () => {
    expect(formatMessage('{done} of {total}', { done: 1, total: 3 })).toBe('1 of 3');
  });

  it('should pick the singular for one', () => {
    expect(formatMessage('{count} {count|Datei|Dateien}', { count: 1 })).toBe('1 Datei');
    expect(formatMessage('{count} {count|Datei|Dateien}', { count: 2 })).toBe('2 Dateien');
    expect(formatMessage('{count} {count|Datei|Dateien}', { count: 0 })).toBe('0 Dateien');
  });

  it('should keep unknown placeholders', () => {
    expect(formatMessage('{name}', {})).toBe('{name}');
  });
});

import { toCsv, toCsvValue } from '#lib/imagepier/csv.ts';

describe('toCsvValue', () => {
  it('should quote values', () => {
    expect(toCsvValue('a "b"')).toBe('"a ""b"""');
    expect(toCsvValue(5)).toBe('"5"');
  });

  it('should protect values that start like a formula', () => {
    expect(toCsvValue('=1+1')).toBe(`"'=1+1"`);
    expect(toCsvValue('-5')).toBe(`"'-5"`);
    expect(toCsvValue('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(toCsvValue('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});

describe('toCsv', () => {
  it('should join cells and rows', () => {
    const rows = [
      ['a', 1],
      ['b', 2],
    ];
    expect(toCsv(rows)).toBe('"a";"1"\r\n"b";"2"');
  });
});

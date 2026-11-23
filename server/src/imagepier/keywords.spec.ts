import { canCreateTags, getKeywordValue, normalizeKeywords, parseKeywordSettings } from 'src/imagepier/keywords.js';

describe('ImagePier keywords', () => {
  it('should clean names and drop invalid and duplicate keywords', () => {
    expect(
      normalizeKeywords([
        { category: ' Place ', name: 'Old  Town' },
        { category: 'Place', name: 'old town' },
        { category: 'Topic', name: 'Food/Drinks', description: ' Restaurants ', active: false },
        { category: '', name: 'Missing category' },
        'invalid',
      ]),
    ).toEqual([
      { category: 'Place', name: 'Old Town', description: undefined, active: true },
      { category: 'Topic', name: 'Food-Drinks', description: 'Restaurants', active: false },
    ]);
  });

  it('should build the tag value from category and keyword', () => {
    expect(getKeywordValue({ category: 'Place', name: 'Harbour' })).toBe('Place/Harbour');
  });

  it('should allow free tags only for administrators once a keyword list exists', () => {
    const stored = { keywords: [{ category: 'Place', name: 'Harbour' }] };
    expect(canCreateTags(false, undefined)).toBe(true);
    expect(canCreateTags(false, stored)).toBe(false);
    expect(canCreateTags(true, stored)).toBe(true);
  });

  it('should read stored settings', () => {
    expect(parseKeywordSettings({ keywords: [{ category: 'Place', name: 'Harbour' }] })).toHaveLength(1);
    expect(parseKeywordSettings(undefined)).toEqual([]);
  });
});

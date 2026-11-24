import { getImagePierTagIds } from 'src/imagepier/metadata-tags.js';
import { getTagLabels } from 'src/imagepier/usage-rights-tags.js';

describe('getImagePierTagIds', () => {
  it('should keep keyword and usage rights tags', () => {
    const tags = [
      { id: 'keyword', value: 'Place/Harbour' },
      { id: 'usage', value: 'Usage rights/Status/Valid' },
      { id: 'file', value: 'Holiday' },
      { id: 'removed', value: 'Place/Beach' },
    ];
    const keywords = { keywords: [{ category: 'Place', name: 'Harbour', active: true }] };

    expect(getImagePierTagIds(tags, keywords, getTagLabels('en'))).toEqual(['keyword', 'usage']);
  });

  it('should keep only usage rights tags without a keyword list', () => {
    const tags = [
      { id: 'usage', value: 'Nutzungsrechte/Status/Freigegeben' },
      { id: 'file', value: 'Urlaub' },
    ];

    expect(getImagePierTagIds(tags, null, getTagLabels('de'))).toEqual(['usage']);
  });
});

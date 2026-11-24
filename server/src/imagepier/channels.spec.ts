import {
  getChannelLabel,
  getDefaultChannels,
  getGalleryChannelIds,
  normalizeChannels,
  parseChannelSettings,
  toChannelId,
} from 'src/imagepier/channels.js';
import { getTagLabels } from 'src/imagepier/usage-rights-tags.js';

describe('channels', () => {
  it('should offer the default channels without a stored list', () => {
    const channels = parseChannelSettings(undefined, getTagLabels('de'));

    expect(channels.map((channel) => channel.id)).toEqual([
      'internal',
      'web',
      'print',
      'social',
      'press',
      'social-ads',
      'presentations',
      'partners',
      'paid-campaigns',
    ]);
    expect(channels.find((channel) => channel.id === 'paid-campaigns')?.label).toBe('Bezahlte Kampagnen');
  });

  it('should derive ids from labels', () => {
    expect(toChannelId('Social Ads', [])).toBe('social-ads');
    expect(toChannelId('Präsentationen', [])).toBe('praesentationen');
    expect(toChannelId('Web', ['web'])).toBe('web-2');
  });

  it('should keep ids, generate missing ones and drop duplicate labels', () => {
    const channels = normalizeChannels([
      { id: 'web', label: 'Homepage', active: true },
      { label: 'Messe', active: false, gallery: true },
      { label: 'homepage', active: true },
      { label: '  ' },
    ]);

    expect(channels).toEqual([
      { id: 'web', label: 'Homepage', active: true, gallery: true },
      { id: 'messe', label: 'Messe', active: false, gallery: true },
    ]);
  });

  it('should mark website and press as gallery channels by default', () => {
    const channels = getDefaultChannels(getTagLabels('en'));

    expect([...getGalleryChannelIds(channels)]).toEqual(['web', 'press']);
    expect(getGalleryChannelIds(normalizeChannels([{ id: 'web', label: 'Web', gallery: false }])).size).toBe(0);
  });

  it('should show the label of a channel', () => {
    const channels = getDefaultChannels(getTagLabels('en'));

    expect(getChannelLabel('press', channels)).toBe('Press');
    expect(getChannelLabel('unknown', channels)).toBe('unknown');
  });
});

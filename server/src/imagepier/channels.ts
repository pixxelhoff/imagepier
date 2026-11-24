import { getTagLabels, type TagLabels } from 'src/imagepier/usage-rights-tags.js';

/**
Channels in which an asset may be used (web, print, social media, ...).

The list is configured by administrators and stored in `system_metadata` under `CHANNELS_KEY`. Usage rights refer
to channels by their id, so renaming a channel keeps all assignments; channels that are no longer offered are
deactivated instead of deleted.
*/

export const CHANNELS_KEY = 'imagepier.channels';

export const MAX_CHANNELS = 50;

export type Channel = { id: string; label: string; active: boolean };

const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const isChannelId = (value: unknown): value is string => typeof value === 'string' && CHANNEL_ID.test(value);

/** The channels offered until an administrator changes the list. */
export const getDefaultChannels = (labels: TagLabels = getTagLabels()): Channel[] =>
  Object.entries(labels.usages).map(([id, label]) => ({ id, label, active: true }));

/** Id for a new channel, derived from its label, e.g. "Social Ads" -> "social-ads". */
export const toChannelId = (label: string, existing: string[]) => {
  const base =
    label
      .toLowerCase()
      .replaceAll('ä', 'ae')
      .replaceAll('ö', 'oe')
      .replaceAll('ü', 'ue')
      .replaceAll('ß', 'ss')
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
      .slice(0, 30) || 'channel';
  let id = base;
  for (let index = 2; existing.includes(id); index++) {
    id = `${base}-${index}`;
  }
  return id;
};

/** Validates a channel list: labels are required and unique, ids are kept or generated. */
export const normalizeChannels = (items: unknown[]): Channel[] => {
  const channels: Channel[] = [];
  for (const item of items.slice(0, MAX_CHANNELS)) {
    const value = (item ?? {}) as Record<string, unknown>;
    const label = typeof value.label === 'string' ? value.label.replaceAll('/', '-').trim().slice(0, 60) : '';
    if (!label || channels.some((channel) => channel.label.toLowerCase() === label.toLowerCase())) {
      continue;
    }
    const ids = channels.map((channel) => channel.id);
    const id = isChannelId(value.id) && !ids.includes(value.id) ? value.id : toChannelId(label, ids);
    channels.push({ id, label, active: value.active !== false });
  }
  return channels;
};

/** Reads the stored list; without a stored list the default channels apply. */
export const parseChannelSettings = (value: unknown, labels?: TagLabels): Channel[] => {
  const items = (value as { channels?: unknown } | null | undefined)?.channels;
  return Array.isArray(items) ? normalizeChannels(items) : getDefaultChannels(labels);
};

/** In-memory copy of the list, kept up to date by the usage rights service. */
let cachedChannels: Channel[] | undefined;

export const setCachedChannels = (channels: Channel[] | undefined) => {
  cachedChannels = channels;
};

export const getCachedChannels = () => cachedChannels ?? getDefaultChannels();

/** Display name of a channel; unknown ids are shown as they are. */
export const getChannelLabel = (id: string, channels: Channel[] = getCachedChannels()) =>
  channels.find((channel) => channel.id === id)?.label ?? id;

import { ipt } from '#lib/imagepier/i18n.ts';
import { getUsageRightsConfig, type UsageRightsConfig } from '#lib/imagepier/usage-rights.ts';
import { searchManager } from '#lib/managers/search-manager.svelte.ts';
import { getAllTags, type TagResponseDto } from '@immich/sdk';
import { mdiCopyright } from '@mdi/js';
import { get } from 'svelte/store';

/**
Search support for usage rights.

Usage rights are mirrored into tags by the server ("Usage rights/Photographer/Jane Doe", ...).
The search tab translates the selected values into tag IDs of Immich's regular tag filter.
*/

export type UsageRightsCategory = 'photographer' | 'copyrightHolder' | 'license' | 'status';
export const USAGE_RIGHTS_CATEGORIES: UsageRightsCategory[] = ['photographer', 'copyrightHolder', 'license', 'status'];

export type UsageRightsOption = { id: string; label: string };

class UsageRightsSearchData {
  config = $state<UsageRightsConfig>();
  tags = $state<TagResponseDto[]>([]);
  private loading?: Promise<void>;

  load() {
    this.loading ??= Promise.all([getUsageRightsConfig(), getAllTags()])
      .then(([config, tags]) => {
        this.config = config;
        this.tags = tags;
      })
      .catch((error: unknown) => {
        this.loading = undefined;
        throw error;
      });
    return this.loading;
  }

  /** Forces the next load() to fetch fresh tags, e.g. after the search dialog was reopened. */
  invalidate() {
    this.loading = undefined;
  }

  getOptions(category: UsageRightsCategory): UsageRightsOption[] {
    if (!this.config) {
      return [];
    }

    const prefix = `${this.config.tags[category]}/`;
    return this.tags
      .filter((tag) => tag.value.startsWith(prefix) && !tag.value.slice(prefix.length).includes('/'))
      .map((tag) => ({ id: tag.id, label: tag.value.slice(prefix.length) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  getSelected(category: UsageRightsCategory, tagIds: Set<string> | null | undefined) {
    if (!tagIds) {
      return;
    }
    return this.getOptions(category).find((option) => tagIds.has(option.id));
  }

  getTitle(tagIds: Set<string> | null | undefined) {
    const labels: string[] = [];
    for (const category of USAGE_RIGHTS_CATEGORIES) {
      const label = this.getSelected(category, tagIds)?.label;
      if (label) {
        labels.push(label);
      }
    }
    return labels.length > 0 ? labels.join(' · ') : undefined;
  }
}

export const usageRightsSearchData = new UsageRightsSearchData();

/** Sets the selected value of one category in Immich's tag filter. */
export const selectUsageRightsOption = (category: UsageRightsCategory, tagId: string | undefined) => {
  const tagIds = searchManager.filter.tagIds;
  if (!tagIds) {
    return;
  }

  for (const option of usageRightsSearchData.getOptions(category)) {
    tagIds.delete(option.id);
  }

  if (tagId) {
    tagIds.add(tagId);
  }
};

/** Entry for the filter buttons of the search dialog. */
export const usageRightsSearchFilter = {
  name: 'usage-rights',
  icon: mdiCopyright,
  get title() {
    return get(ipt)('usage_rights');
  },
  activeTitle: () => usageRightsSearchData.getTitle(searchManager.filter.tagIds),
};

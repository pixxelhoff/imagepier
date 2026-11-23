import { ipt } from '#lib/imagepier/i18n.ts';
import { getKeywordTags, getKeywordValue, getKeywords, groupKeywords, type Keyword } from '#lib/imagepier/keywords.ts';
import { searchManager } from '#lib/managers/search-manager.svelte.ts';
import { mdiTagMultipleOutline } from '@mdi/js';
import { get } from 'svelte/store';

/**
Search support for keywords.

A keyword is a tag of every account that owns tagged assets (own account, area accounts). The search tab adds the
tags of all these accounts to Immich's tag filter; the server counts tags with the same value as one tag, so all
selected keywords must apply and the search covers all accessible areas at once.
*/
class KeywordSearchData {
  keywords = $state<Keyword[]>([]);
  tagIdsByValue = $state<Record<string, string[]>>({});
  private loading?: Promise<void>;

  /** Keywords that are assigned to at least one accessible asset. */
  get groups() {
    return groupKeywords(
      this.keywords.filter((keyword) => Object.hasOwn(this.tagIdsByValue, getKeywordValue(keyword))),
    );
  }

  load() {
    this.loading ??= Promise.all([getKeywords(), getKeywordTags()])
      .then(([keywords, tags]) => {
        const byValue: Record<string, string[]> = {};
        for (const tag of tags) {
          byValue[tag.value] = [...(byValue[tag.value] ?? []), tag.id];
        }
        this.keywords = keywords;
        this.tagIdsByValue = byValue;
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

  private getTagIds(value: string) {
    return Object.hasOwn(this.tagIdsByValue, value) ? this.tagIdsByValue[value] : [];
  }

  isSelected(value: string, tagIds: Set<string> | null | undefined) {
    return !!tagIds && this.getTagIds(value).some((id) => tagIds.has(id));
  }

  toggle(value: string, checked: boolean) {
    const tagIds = searchManager.filter.tagIds;
    if (!tagIds) {
      return;
    }

    for (const id of this.getTagIds(value)) {
      if (checked) {
        tagIds.add(id);
      } else {
        tagIds.delete(id);
      }
    }
  }

  getTitle(tagIds: Set<string> | null | undefined) {
    const names = this.keywords
      .filter((keyword) => this.isSelected(getKeywordValue(keyword), tagIds))
      .map((keyword) => keyword.name);
    return names.length > 0 ? names.join(' · ') : undefined;
  }
}

export const keywordSearchData = new KeywordSearchData();

/** Entry for the filter buttons of the search dialog. */
export const keywordSearchFilter = {
  name: 'keywords',
  icon: mdiTagMultipleOutline,
  get title() {
    return get(ipt)('keywords');
  },
  activeTitle: () => keywordSearchData.getTitle(searchManager.filter.tagIds),
};

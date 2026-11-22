import {
  getLibraryTags,
  getMediaLibraryAccess,
  getVisibleAreas,
  type Area,
  type AreaTag,
  type LibraryTag,
} from '#lib/imagepier/access.ts';
import { ipt } from '#lib/imagepier/i18n.ts';
import { getUsageRightsConfig, type UsageRightsConfig } from '#lib/imagepier/usage-rights.ts';
import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import { searchManager } from '#lib/managers/search-manager.svelte.ts';
import { getAllTags } from '@immich/sdk';
import { mdiCopyright } from '@mdi/js';
import { get } from 'svelte/store';

/**
Search support for usage rights.

Usage rights are mirrored into tags by the server ("Usage rights/Photographer/Jane Doe", ...).
The search tab translates the selected values into tag IDs of Immich's regular tag filter.
Tags belong to the owner of the assets, so media library assets carry tags of the account of their area.
Immich combines tag IDs with AND, therefore one search uses the tags of one area or the own tags.
*/

export type UsageRightsCategory = Exclude<keyof UsageRightsConfig['tags'], 'root'>;

/** Categories with a single selection. */
export const USAGE_RIGHTS_SELECT_CATEGORIES: UsageRightsCategory[] = [
  'area',
  'missing',
  'status',
  'photographer',
  'copyrightHolder',
  'license',
  'licenseSource',
  'creditLine',
  'validUntil',
];

/** Category with multiple selections; all selected uses must be permitted. */
export const USAGE_RIGHTS_MULTI_CATEGORY: UsageRightsCategory = 'usage';

const ALL_CATEGORIES = [...USAGE_RIGHTS_SELECT_CATEGORIES, USAGE_RIGHTS_MULTI_CATEGORY];

export type UsageRightsOption = { id: string; label: string };

/** `own` or the id of an area. */
export type UsageRightsScope = string;

export const OWN_SCOPE = 'own';

const loadLibrary = async (): Promise<{ areas: Area[]; tags: AreaTag[] }> => {
  try {
    const access = await getMediaLibraryAccess(authManager.user.id);
    return access?.libraryUserId
      ? { areas: getVisibleAreas(access), tags: await getLibraryTags() }
      : { areas: [], tags: [] };
  } catch {
    return { areas: [], tags: [] };
  }
};

class UsageRightsSearchData {
  config = $state<UsageRightsConfig>();
  ownTags = $state<LibraryTag[]>([]);
  libraryTags = $state<AreaTag[]>([]);
  areas = $state<Area[]>([]);
  scope = $state<UsageRightsScope>(OWN_SCOPE);
  private loading?: Promise<void>;

  get tags(): LibraryTag[] {
    return this.getTagsOf(this.scope);
  }

  private getTagsOf(scope: UsageRightsScope): LibraryTag[] {
    return scope === OWN_SCOPE ? this.ownTags : this.libraryTags.filter((tag) => tag.areaId === scope);
  }

  /** Areas and own photos that can be searched, i.e. that have usage rights tags. */
  getScopes() {
    return [
      ...this.areas.filter((area) => this.hasUsageRightsTags(this.getTagsOf(area.id))).map((area) => area.id),
      ...(this.hasUsageRightsTags(this.ownTags) ? [OWN_SCOPE] : []),
    ];
  }

  getAreaName(scope: UsageRightsScope) {
    return this.areas.find((area) => area.id === scope)?.name;
  }

  load() {
    this.loading ??= Promise.all([getUsageRightsConfig(), getAllTags(), loadLibrary()])
      .then(([config, ownTags, library]) => {
        this.config = config;
        this.ownTags = ownTags;
        this.areas = library.areas;
        this.libraryTags = library.tags;
        this.scope = this.detectScope();
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

  /** Keeps the scope of a previous search; otherwise the first area with tags is searched. */
  private detectScope(): UsageRightsScope {
    const selected = searchManager.filter.tagIds;
    if (selected && this.ownTags.some((tag) => selected.has(tag.id))) {
      return OWN_SCOPE;
    }
    const previous = selected ? this.libraryTags.find((tag) => selected.has(tag.id)) : undefined;
    return previous?.areaId ?? this.getScopes()[0] ?? OWN_SCOPE;
  }

  private hasUsageRightsTags(tags: LibraryTag[]) {
    const prefix = this.config ? `${this.config.tags.root}/` : undefined;
    return !!prefix && tags.some((tag) => tag.value.startsWith(prefix));
  }

  /** Whether more than one area or the own photos can be searched. */
  hasScopeChoice() {
    return this.getScopes().length > 1;
  }

  /** Switches the scope and removes the selected values of the previous scope. */
  setScope(value: string) {
    const scope: UsageRightsScope = this.getScopes().includes(value) ? value : OWN_SCOPE;
    const tagIds = searchManager.filter.tagIds;
    if (scope === this.scope || !tagIds) {
      this.scope = scope;
      return;
    }

    for (const category of ALL_CATEGORIES) {
      for (const option of this.getOptions(category)) {
        tagIds.delete(option.id);
      }
    }
    this.scope = scope;
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
    return this.getAllSelected(category, tagIds)[0];
  }

  getAllSelected(category: UsageRightsCategory, tagIds: Set<string> | null | undefined) {
    if (!tagIds) {
      return [];
    }
    return this.getOptions(category).filter((option) => tagIds.has(option.id));
  }

  hasAnyOptions() {
    return ALL_CATEGORIES.some((category) => this.getOptions(category).length > 0);
  }

  getTitle(tagIds: Set<string> | null | undefined) {
    const labels = ALL_CATEGORIES.flatMap((category) =>
      this.getAllSelected(category, tagIds).map((option) => option.label),
    );
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

/** Adds or removes one value of a category with multiple selections. */
export const toggleUsageRightsOption = (tagId: string, checked: boolean) => {
  const tagIds = searchManager.filter.tagIds;
  if (!tagIds) {
    return;
  }

  if (checked) {
    tagIds.add(tagId);
  } else {
    tagIds.delete(tagId);
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

<script lang="ts">
  import { ipt, type ImagePierMessageKey } from '#lib/imagepier/i18n.ts';
  import {
    OWN_SCOPE,
    USAGE_RIGHTS_MULTI_CATEGORY,
    USAGE_RIGHTS_SELECT_CATEGORIES,
    selectUsageRightsOption,
    toggleUsageRightsOption,
    usageRightsSearchData,
    type UsageRightsCategory,
  } from '#lib/imagepier/usage-rights-search.svelte.ts';
  import { searchManager } from '#lib/managers/search-manager.svelte.ts';
  import { Checkbox, Field, HelperText, Label, Select, Text } from '@immich/ui';
  import { onMount } from 'svelte';

  const categoryLabels: Record<UsageRightsCategory, ImagePierMessageKey> = {
    area: 'area',
    missing: 'missing_fields',
    status: 'status',
    photographer: 'photographer',
    copyrightHolder: 'copyright_holder',
    license: 'license_type',
    licenseSource: 'license_source',
    creditLine: 'credit_line',
    validUntil: 'valid_until',
    usage: 'permitted_usage',
  };

  let failed = $state(false);

  onMount(() => {
    usageRightsSearchData.invalidate();
    void usageRightsSearchData.load().catch(() => (failed = true));
  });

  const getOptions = (category: UsageRightsCategory) => [
    { label: $ipt('any'), value: '' },
    ...usageRightsSearchData.getOptions(category).map((option) => ({ label: option.label, value: option.id })),
  ];

  const getValue = (category: UsageRightsCategory) =>
    usageRightsSearchData.getSelected(category, searchManager.filter.tagIds)?.id ?? '';

  const setValue = (category: UsageRightsCategory, value: string) =>
    selectUsageRightsOption(category, value || undefined);

  const isChecked = (tagId: string) => searchManager.filter.tagIds?.has(tagId) ?? false;

  const selectCategories = $derived(
    USAGE_RIGHTS_SELECT_CATEGORIES.filter((category) => usageRightsSearchData.getOptions(category).length > 0),
  );
  const usageOptions = $derived(usageRightsSearchData.getOptions(USAGE_RIGHTS_MULTI_CATEGORY));

  const scopeOptions = $derived(
    usageRightsSearchData.getScopes().map((scope) => ({
      label:
        scope === OWN_SCOPE
          ? $ipt('search_scope_own')
          : $ipt('photos_area', { name: usageRightsSearchData.getAreaName(scope) ?? scope }),
      value: scope,
    })),
  );
</script>

<div data-testid="imagepier-search-usage-rights-section">
  <Text class="pb-5">{$ipt('search_usage_rights_description')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('usage_rights_load_failed')}</HelperText>
  {:else if searchManager.filter.tagIds === null}
    <Text color="muted">{$ipt('search_usage_rights_untagged')}</Text>
  {:else if usageRightsSearchData.config && !usageRightsSearchData.hasAnyOptions()}
    <Text color="muted">{$ipt('usage_rights_none')}</Text>
  {:else}
    {#if usageRightsSearchData.hasScopeChoice()}
      <div class="mb-4">
        <Field label={$ipt('search_scope')}>
          <Select
            options={scopeOptions}
            bind:value={() => usageRightsSearchData.scope, (value) => usageRightsSearchData.setScope(value)}
          />
        </Field>
      </div>
    {/if}

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each selectCategories as category (category)}
        <Field label={$ipt(categoryLabels[category])}>
          <Select
            options={getOptions(category)}
            bind:value={() => getValue(category), (value) => setValue(category, value)}
          />
        </Field>
      {/each}
    </div>

    {#if usageOptions.length > 0}
      <div class="mt-4">
        <Label label={$ipt('permitted_usage')} />
        <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {#each usageOptions as option (option.id)}
            <div class="flex items-center gap-2">
              <Checkbox
                id="imagepier-search-usage-{option.id}"
                size="tiny"
                checked={isChecked(option.id)}
                onCheckedChange={(checked) => toggleUsageRightsOption(option.id, checked)}
              />
              <Label label={option.label} for="imagepier-search-usage-{option.id}" />
            </div>
          {/each}
        </div>
        <HelperText>{$ipt('search_usage_rights_usage_hint')}</HelperText>
      </div>
    {/if}
  {/if}
</div>

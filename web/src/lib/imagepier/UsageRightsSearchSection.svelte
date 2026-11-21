<script lang="ts">
  import { ipt, type ImagePierMessageKey } from '#lib/imagepier/i18n.ts';
  import {
    USAGE_RIGHTS_CATEGORIES,
    selectUsageRightsOption,
    usageRightsSearchData,
    type UsageRightsCategory,
  } from '#lib/imagepier/usage-rights-search.svelte.ts';
  import { searchManager } from '#lib/managers/search-manager.svelte.ts';
  import { Field, HelperText, Select, Text } from '@immich/ui';
  import { onMount } from 'svelte';

  const categoryLabels: Record<UsageRightsCategory, ImagePierMessageKey> = {
    photographer: 'photographer',
    copyrightHolder: 'copyright_holder',
    license: 'license_type',
    status: 'status',
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

  const hasAnyOptions = $derived(
    USAGE_RIGHTS_CATEGORIES.some((category) => usageRightsSearchData.getOptions(category).length > 0),
  );
</script>

<div data-testid="imagepier-search-usage-rights-section">
  <Text class="pb-5">{$ipt('search_usage_rights_description')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('usage_rights_load_failed')}</HelperText>
  {:else if searchManager.filter.tagIds === null}
    <Text color="muted">{$ipt('search_usage_rights_untagged')}</Text>
  {:else if usageRightsSearchData.config && !hasAnyOptions}
    <Text color="muted">{$ipt('usage_rights_none')}</Text>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each USAGE_RIGHTS_CATEGORIES as category (category)}
        <Field label={$ipt(categoryLabels[category])}>
          <Select
            options={getOptions(category)}
            bind:value={() => getValue(category), (value) => setValue(category, value)}
          />
        </Field>
      {/each}
    </div>
  {/if}
</div>

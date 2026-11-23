<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { keywordSearchData } from '#lib/imagepier/keyword-search.svelte.ts';
  import { getKeywordValue } from '#lib/imagepier/keywords.ts';
  import { searchManager } from '#lib/managers/search-manager.svelte.ts';
  import { Checkbox, HelperText, Input, Label, Text } from '@immich/ui';
  import { onMount } from 'svelte';

  let failed = $state(false);
  let filter = $state('');

  onMount(() => {
    keywordSearchData.invalidate();
    keywordSearchData.load().catch(() => {
      failed = true;
    });
  });

  const groups = $derived.by(() => {
    const query = filter.trim().toLowerCase();
    return keywordSearchData.groups
      .map((group) => ({
        category: group.category,
        keywords: group.keywords.filter(
          (keyword) => !query || `${keyword.category} ${keyword.name}`.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.keywords.length > 0);
  });
</script>

<div data-testid="imagepier-search-keywords-section">
  <Text class="pb-5">{$ipt('search_keywords_description')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('keywords_load_failed')}</HelperText>
  {:else if searchManager.filter.tagIds === null}
    <Text color="muted">{$ipt('search_usage_rights_untagged')}</Text>
  {:else if keywordSearchData.groups.length === 0}
    <Text color="muted">{$ipt('search_keywords_none')}</Text>
  {:else}
    <div class="mb-4">
      <Input bind:value={filter} aria-label={$ipt('keywords_filter')} placeholder={$ipt('keywords_filter')} />
    </div>

    <div class="flex flex-col gap-4">
      {#each groups as group, groupIndex (group.category)}
        <div>
          <Label label={group.category} />
          <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {#each group.keywords as keyword, index (getKeywordValue(keyword))}
              <div class="flex items-center gap-2" title={keyword.description}>
                <Checkbox
                  id="imagepier-search-keyword-{groupIndex}-{index}"
                  size="tiny"
                  checked={keywordSearchData.isSelected(getKeywordValue(keyword), searchManager.filter.tagIds)}
                  onCheckedChange={(checked) => keywordSearchData.toggle(getKeywordValue(keyword), checked)}
                />
                <Label label={keyword.name} for="imagepier-search-keyword-{groupIndex}-{index}" />
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <HelperText>{$ipt('search_keywords_hint')}</HelperText>
  {/if}
</div>

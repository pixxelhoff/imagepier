<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    getKeywordValue,
    getKeywords,
    groupKeywords,
    mergeKeywordImport,
    parseKeywordTable,
    updateKeywordsAdmin,
    type Keyword,
  } from '#lib/imagepier/keywords.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { Button, Checkbox, HelperText, Label, Stack, Text, Textarea, toastManager } from '@immich/ui';
  import { onMount } from 'svelte';

  let keywords = $state<Keyword[]>([]);
  let failed = $state(false);
  let saving = $state(false);
  let pasted = $state('');

  const imported = $derived(parseKeywordTable(pasted));
  const importedCategories = $derived(new Set(imported.map((keyword) => keyword.category)).size);
  const groups = $derived(groupKeywords(keywords));
  const activeCount = $derived(keywords.filter((keyword) => keyword.active).length);

  const load = async () => {
    try {
      keywords = await getKeywords();
      failed = false;
    } catch {
      failed = true;
    }
  };

  onMount(() => {
    void load();
  });

  const save = async (list: Keyword[]) => {
    saving = true;
    try {
      keywords = await updateKeywordsAdmin(list);
      toastManager.primary($ipt('keywords_saved'));
      return true;
    } catch (error) {
      handleError(error, $ipt('keywords_save_failed'));
      return false;
    } finally {
      saving = false;
    }
  };

  const applyImport = async () => {
    if (await save(mergeKeywordImport(keywords, imported))) {
      pasted = '';
    }
  };

  const setActive = (value: string, active: boolean) => {
    keywords = keywords.map((keyword) => (getKeywordValue(keyword) === value ? { ...keyword, active } : keyword));
  };
</script>

<Stack gap={6}>
  <Text color="muted">{$ipt('keywords_admin_description')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('keywords_load_failed')}</HelperText>
  {:else}
    <Stack gap={2}>
      <Label label={$ipt('keywords_import')} for="imagepier-keywords-import" />
      <Textarea
        id="imagepier-keywords-import"
        bind:value={pasted}
        rows={6}
        placeholder={$ipt('keywords_import_placeholder')}
      />
      {#if imported.length > 0}
        <Text size="small">
          {$ipt('keywords_import_preview', { count: imported.length, categories: importedCategories })}
        </Text>
        <Text size="small" color="muted">{$ipt('keywords_import_hint')}</Text>
        <div>
          <Button onclick={applyImport} loading={saving}>{$ipt('keywords_import_apply')}</Button>
        </div>
      {/if}
    </Stack>

    {#if keywords.length === 0}
      <Text size="small" color="muted">{$ipt('keywords_empty')}</Text>
    {:else}
      <Text size="small" color="muted">
        {$ipt('keywords_count', { active: activeCount, inactive: keywords.length - activeCount })}
      </Text>
      {#each groups as group, groupIndex (group.category)}
        <div>
          <Label label={group.category} />
          <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {#each group.keywords as keyword, index (getKeywordValue(keyword))}
              <div class="flex items-center gap-2" title={keyword.description}>
                <Checkbox
                  id="imagepier-keyword-admin-{groupIndex}-{index}"
                  size="tiny"
                  checked={keyword.active}
                  onCheckedChange={(checked) => setActive(getKeywordValue(keyword), checked)}
                />
                <Label label={keyword.name} for="imagepier-keyword-admin-{groupIndex}-{index}" />
              </div>
            {/each}
          </div>
        </div>
      {/each}
      <div>
        <Button onclick={() => void save(keywords)} loading={saving}>{$ipt('save')}</Button>
      </div>
    {/if}
  {/if}
</Stack>

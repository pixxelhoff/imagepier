<script lang="ts">
  import KeywordEditModal from '#lib/imagepier/KeywordEditModal.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    addKeywordAdmin,
    deleteKeywordAdmin,
    editKeywordAdmin,
    getKeywordInUseCount,
    getKeywordValue,
    getKeywords,
    groupKeywords,
    mergeKeywordImport,
    parseKeywordTable,
    updateKeywordsAdmin,
    type Keyword,
  } from '#lib/imagepier/keywords.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import {
    Button,
    Checkbox,
    HelperText,
    Input,
    Label,
    Stack,
    Text,
    Textarea,
    modalManager,
    toastManager,
  } from '@immich/ui';
  import { mdiPlus } from '@mdi/js';
  import { onMount } from 'svelte';

  let keywords = $state<Keyword[]>([]);
  let failed = $state(false);
  let saving = $state(false);
  let pasted = $state('');
  let filter = $state('');

  const imported = $derived(parseKeywordTable(pasted));
  const importedCategories = $derived(new Set(imported.map((keyword) => keyword.category)).size);
  const categories = $derived([...new Set(keywords.map((keyword) => keyword.category))]);
  const groups = $derived.by(() => {
    const query = filter.trim().toLowerCase();
    return groupKeywords(
      query
        ? keywords.filter((keyword) =>
            `${keyword.category} ${keyword.name} ${keyword.description ?? ''}`.toLowerCase().includes(query),
          )
        : keywords,
    );
  });
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

  /** Runs a change of single keywords; the server returns the new list. */
  const change = async (action: () => Promise<Keyword[]>) => {
    saving = true;
    try {
      keywords = await action();
      toastManager.primary($ipt('keywords_saved'));
    } catch (error) {
      const count = getKeywordInUseCount(error);
      if (count === undefined) {
        handleError(error, $ipt('keywords_save_failed'));
      } else {
        toastManager.danger(count === 1 ? $ipt('keyword_in_use_one') : $ipt('keyword_in_use', { count }));
      }
    } finally {
      saving = false;
    }
  };

  const setActive = (keyword: Keyword, active: boolean) =>
    change(() => editKeywordAdmin(getKeywordValue(keyword), { ...keyword, active }));

  const openEditor = async (keyword?: Keyword) => {
    const result = await modalManager.show(KeywordEditModal, { keyword, categories });
    if (!result) {
      return;
    }

    if (result.action === 'delete' && keyword) {
      await change(() => deleteKeywordAdmin(getKeywordValue(keyword)));
    } else if (result.action === 'save') {
      const updated = result.keyword;
      await change(() =>
        keyword
          ? editKeywordAdmin(getKeywordValue(keyword), updated)
          : addKeywordAdmin({ category: updated.category, name: updated.name, description: updated.description }),
      );
    }
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

    <div>
      <Button leadingIcon={mdiPlus} size="small" onclick={() => openEditor()} disabled={saving}>
        {$ipt('keyword_add_title')}
      </Button>
    </div>

    {#if keywords.length === 0}
      <Text size="small" color="muted">{$ipt('keywords_empty')}</Text>
    {:else}
      <Text size="small" color="muted">
        {$ipt('keywords_count', { active: activeCount, inactive: keywords.length - activeCount })}
        {$ipt('keywords_admin_edit_hint')}
      </Text>
      <Input bind:value={filter} aria-label={$ipt('keywords_filter')} placeholder={$ipt('keywords_filter')} />
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
                  disabled={saving}
                  onCheckedChange={(checked) => setActive(keyword, checked)}
                />
                <Button size="tiny" variant="ghost" color="secondary" onclick={() => openEditor(keyword)}>
                  {keyword.name}
                </Button>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  {/if}
</Stack>

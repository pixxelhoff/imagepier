<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { getKeywordValue, groupKeywords, type Keyword, type KeywordChange } from '#lib/imagepier/keywords.ts';
  import { Checkbox, FormModal, Input, Label, Select, Stack, Text } from '@immich/ui';
  import { mdiTagMultipleOutline } from '@mdi/js';

  type Props = {
    keywords: Keyword[];
    selected?: string[];
    title?: string;
    bulk?: boolean;
    onClose: (change?: KeywordChange) => void;
  };

  let { keywords, selected = [], title, bulk = false, onClose }: Props = $props();

  let chosen = $state<string[]>([...selected]);
  let mode = $state('add');
  let filter = $state('');

  const modeOptions = $derived([
    { label: $ipt('keywords_bulk_add'), value: 'add' },
    { label: $ipt('keywords_bulk_remove'), value: 'remove' },
  ]);

  // Deactivated keywords are only shown while an asset still has them, so they can be removed.
  const visible = $derived(
    keywords.filter((keyword) => keyword.active || (!bulk && selected.includes(getKeywordValue(keyword)))),
  );

  const groups = $derived.by(() => {
    const query = filter.trim().toLowerCase();
    return groupKeywords(
      visible.filter((keyword) => !query || `${keyword.category} ${keyword.name}`.toLowerCase().includes(query)),
    );
  });

  const activeValues = $derived(
    new Set(keywords.filter((keyword) => keyword.active).map((keyword) => getKeywordValue(keyword))),
  );

  const toggle = (value: string, checked: boolean) => {
    chosen = checked ? [...chosen, value] : chosen.filter((item) => item !== value);
  };

  const onSubmit = () => {
    if (bulk) {
      onClose(mode === 'remove' ? { add: [], remove: chosen } : { add: chosen, remove: [] });
      return;
    }

    onClose({
      add: chosen.filter((value) => !selected.includes(value) && activeValues.has(value)),
      remove: selected.filter((value) => !chosen.includes(value)),
    });
  };
</script>

<FormModal
  title={title ?? $ipt('keywords_edit')}
  icon={mdiTagMultipleOutline}
  onClose={() => onClose()}
  {onSubmit}
  size="medium"
>
  <Stack gap={4}>
    {#if bulk}
      <Text size="small" color="muted">{$ipt('keywords_bulk_hint')}</Text>
      <Select bind:value={mode} options={modeOptions} />
    {/if}

    <Input bind:value={filter} aria-label={$ipt('keywords_filter')} placeholder={$ipt('keywords_filter')} />

    {#if groups.length === 0}
      <Text size="small" color="muted">{$ipt('keywords_empty')}</Text>
    {/if}

    {#each groups as group, groupIndex (group.category)}
      <div>
        <Label label={group.category} />
        <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {#each group.keywords as keyword, index (getKeywordValue(keyword))}
            <div class="flex items-center gap-2" title={keyword.description}>
              <Checkbox
                id="imagepier-keyword-{groupIndex}-{index}"
                size="tiny"
                checked={chosen.includes(getKeywordValue(keyword))}
                onCheckedChange={(checked) => toggle(getKeywordValue(keyword), checked)}
              />
              <Label label={keyword.name} for="imagepier-keyword-{groupIndex}-{index}" />
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </Stack>
</FormModal>

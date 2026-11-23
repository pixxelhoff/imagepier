<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import type { Keyword, KeywordEditResult } from '#lib/imagepier/keywords.ts';
  import { Button, Field, FormModal, HelperText, Input, Stack, Switch, Text, Textarea } from '@immich/ui';
  import { mdiTagEditOutline, mdiTagPlusOutline } from '@mdi/js';

  type Props = {
    /** Keyword to edit; without a keyword a new one is added. */
    keyword?: Keyword;
    categories: string[];
    onClose: (result?: KeywordEditResult) => void;
  };

  let { keyword, categories, onClose }: Props = $props();

  let category = $state(keyword?.category ?? '');
  let name = $state(keyword?.name ?? '');
  let description = $state(keyword?.description ?? '');
  let active = $state(keyword?.active ?? true);
  let missing = $state(false);

  const renamed = $derived(!!keyword && (category.trim() !== keyword.category || name.trim() !== keyword.name));

  const onSubmit = () => {
    if (!category.trim() || !name.trim()) {
      missing = true;
      return;
    }
    onClose({
      action: 'save',
      keyword: { category: category.trim(), name: name.trim(), description: description.trim() || undefined, active },
    });
  };
</script>

<FormModal
  title={keyword ? $ipt('keyword_edit_title') : $ipt('keyword_add_title')}
  icon={keyword ? mdiTagEditOutline : mdiTagPlusOutline}
  onClose={() => onClose()}
  {onSubmit}
  size="small"
>
  <Stack gap={4}>
    <Field label={$ipt('keyword_category')}>
      <Input bind:value={category} />
    </Field>
    {#if categories.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each categories as item (item)}
          <Button size="tiny" variant="outline" color="secondary" onclick={() => (category = item)}>{item}</Button>
        {/each}
      </div>
    {/if}

    <Field label={$ipt('keyword_name')}>
      <Input bind:value={name} />
    </Field>

    <Field label={$ipt('keyword_description')}>
      <Textarea bind:value={description} rows={2} />
    </Field>

    {#if keyword}
      <Field label={$ipt('keyword_active')}>
        <Switch bind:checked={active} />
      </Field>
    {/if}

    {#if missing}
      <HelperText color="danger">{$ipt('keyword_required')}</HelperText>
    {/if}
    {#if renamed}
      <Text size="small" color="muted">{$ipt('keyword_rename_hint')}</Text>
    {/if}

    {#if keyword}
      <div>
        <Button size="small" variant="outline" color="danger" onclick={() => onClose({ action: 'delete' })}>
          {$ipt('keyword_delete')}
        </Button>
      </div>
      <Text size="small" color="muted">{$ipt('keyword_delete_hint')}</Text>
    {/if}
  </Stack>
</FormModal>

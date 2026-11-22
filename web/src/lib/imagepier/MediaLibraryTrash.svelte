<script lang="ts">
  import { getLibraryTrash, type LibraryTrashItem } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { getAssetMediaUrl } from '#lib/utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { AssetMediaSize, deleteAssets, restoreAssets } from '@immich/sdk';
  import { Button, HelperText, Stack, Text, modalManager, toastManager } from '@immich/ui';
  import { mdiDeleteForeverOutline, mdiHistory } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount } from 'svelte';

  let items = $state<LibraryTrashItem[]>([]);
  let loaded = $state(false);
  let failed = $state(false);

  const load = async () => {
    try {
      items = await getLibraryTrash();
      failed = false;
    } catch {
      failed = true;
    } finally {
      loaded = true;
    }
  };

  onMount(() => {
    void load();
  });

  const remove = (id: string) => {
    items = items.filter((item) => item.id !== id);
  };

  const restore = async (item: LibraryTrashItem) => {
    try {
      await restoreAssets({ bulkIdsDto: { ids: [item.id] } });
      remove(item.id);
      toastManager.primary($ipt('library_trash_restored'));
    } catch (error) {
      handleError(error, $ipt('library_trash_failed'));
    }
  };

  const deletePermanently = async (item: LibraryTrashItem) => {
    const isConfirmed = await modalManager.showDialog({
      prompt: $ipt('library_trash_delete_confirm', { name: item.originalFileName }),
    });
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteAssets({ assetBulkDeleteDto: { ids: [item.id], force: true } });
      remove(item.id);
      toastManager.primary($ipt('library_trash_deleted'));
    } catch (error) {
      handleError(error, $ipt('library_trash_failed'));
    }
  };

  const formatDate = (value: string) =>
    DateTime.fromISO(value).toLocaleString(DateTime.DATETIME_SHORT, { locale: $locale });
</script>

<Stack gap={4}>
  <Text color="muted">{$ipt('library_trash_description')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('library_trash_load_failed')}</HelperText>
  {:else if loaded && items.length === 0}
    <Text color="muted">{$ipt('library_trash_empty')}</Text>
  {:else}
    {#each items as item (item.id)}
      <div class="flex items-center gap-4" data-testid="imagepier-library-trash-item">
        <img
          src={getAssetMediaUrl({ id: item.id, size: AssetMediaSize.Thumbnail })}
          alt={item.originalFileName}
          class="size-16 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
        <div class="min-w-0 grow">
          <Text class="truncate">{item.originalFileName}</Text>
          <Text size="small" color="muted">
            {formatDate(item.deletedAt)}
            {#if item.deletedBy}
              · {$ipt('library_trash_deleted_by', { name: item.deletedBy })}
            {/if}
          </Text>
        </div>
        <Button size="small" variant="ghost" leadingIcon={mdiHistory} onclick={() => restore(item)}>
          {$ipt('library_trash_restore')}
        </Button>
        <Button
          size="small"
          variant="ghost"
          color="danger"
          leadingIcon={mdiDeleteForeverOutline}
          onclick={() => deletePermanently(item)}
        >
          {$ipt('library_trash_delete')}
        </Button>
      </div>
    {/each}
  {/if}
</Stack>

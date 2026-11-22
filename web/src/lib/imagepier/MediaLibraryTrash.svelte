<script lang="ts">
  import {
    canManageAreaOf,
    getLibraryTrash,
    getMyAccess,
    type LibraryTrashItem,
    type MyAccess,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { getAssetMediaUrl } from '#lib/utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { AssetMediaSize, deleteAssets, restoreAssets } from '@immich/sdk';
  import { Button, Field, HelperText, Select, Stack, Text, modalManager, toastManager } from '@immich/ui';
  import { mdiDeleteForeverOutline, mdiHistory } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount } from 'svelte';

  /**
  Trash of the media library areas where the user is editor or media manager (externals: only their deliveries).
  Restoring needs the level editor, deleting permanently the level media manager; the server checks both.
  */
  let items = $state<LibraryTrashItem[]>([]);
  let access = $state<MyAccess>();
  let areaFilter = $state('');
  let loaded = $state(false);
  let failed = $state(false);

  const load = async () => {
    try {
      [items, access] = await Promise.all([getLibraryTrash(), getMyAccess(authManager.user.id)]);
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

  const getAreaName = (areaId: string | undefined) => access?.allAreas.find((area) => area.id === areaId)?.name;

  const canDelete = (item: LibraryTrashItem) => !!access && !!item.areaId && canManageAreaOf(access, item.areaId);

  // Only areas that have items in the trash can be selected.
  const areaOptions = $derived([
    { label: $ipt('library_trash_all_areas'), value: '' },
    ...(access?.allAreas ?? [])
      .filter((area) => items.some((item) => item.areaId === area.id))
      .map((area) => ({ label: area.name, value: area.id })),
  ]);

  const visibleItems = $derived(areaFilter ? items.filter((item) => item.areaId === areaFilter) : items);

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
    {#if areaOptions.length > 2}
      <div class="max-w-xs">
        <Field label={$ipt('area')}>
          <Select options={areaOptions} bind:value={areaFilter} />
        </Field>
      </div>
    {/if}

    {#each visibleItems as item (item.id)}
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
            {#if getAreaName(item.areaId)}
              {getAreaName(item.areaId)} ·
            {/if}
            {formatDate(item.deletedAt)}
            {#if item.deletedBy}
              · {$ipt('library_trash_deleted_by', { name: item.deletedBy })}
            {/if}
          </Text>
        </div>
        <Button size="small" variant="ghost" leadingIcon={mdiHistory} onclick={() => restore(item)}>
          {$ipt('library_trash_restore')}
        </Button>
        {#if canDelete(item)}
          <Button
            size="small"
            variant="ghost"
            color="danger"
            leadingIcon={mdiDeleteForeverOutline}
            onclick={() => deletePermanently(item)}
          >
            {$ipt('library_trash_delete')}
          </Button>
        {/if}
      </div>
    {/each}
  {/if}
</Stack>

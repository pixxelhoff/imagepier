<script lang="ts">
  import AreaModal from '#lib/imagepier/AreaModal.svelte';
  import UsageRightsModal from '#lib/imagepier/UsageRightsModal.svelte';
  import {
    canEditAreaOf,
    canManageAreaOf,
    getAreaOfOwner,
    getAssignableAreas,
    getMediaLibraryAccess,
    moveToMediaLibrary,
    type MyAccess,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { applyUsageRightsToAssets, confirmUsageRights, toUsageRightsPatch } from '#lib/imagepier/usage-rights.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { deleteAssets } from '@immich/sdk';
  import { IconButton, modalManager, toastManager } from '@immich/ui';
  import { mdiCheckDecagramOutline, mdiCopyright, mdiDeleteOutline, mdiFolderMultipleImage } from '@mdi/js';

  /**
  Actions for editors and media managers in the view of an area (the timeline of the area account).
  The server checks the areas; assets outside the user's areas are rejected.
  */
  type Props = {
    ownerId: string;
  };

  const { ownerId }: Props = $props();

  let access = $state<MyAccess>();

  const loadAccess = async (userId: string) => {
    try {
      access = await getMediaLibraryAccess(userId);
    } catch {
      access = undefined;
    }
  };

  $effect(() => {
    void loadAccess(authManager.user.id);
  });

  const area = $derived(access ? getAreaOfOwner(access, ownerId) : undefined);
  const canEdit = $derived(!!access && !!area && canEditAreaOf(access, area.id));
  // Externals maintain the assets they added, but do not move media library assets between areas.
  const canMove = $derived(canEdit && access?.role !== 'external');
  const canConfirm = $derived(!!access && !!area && canManageAreaOf(access, area.id));

  const getSelectedIds = () => assetMultiSelectManager.assets.map((asset) => asset.id);

  const handleUsageRights = async () => {
    const ids = getSelectedIds();
    const result = await modalManager.show(UsageRightsModal, {
      title: $ipt('usage_rights_bulk_title', { count: ids.length }),
      hint: $ipt('usage_rights_bulk_hint'),
    });
    if (!result) {
      return;
    }

    try {
      await applyUsageRightsToAssets(ids, toUsageRightsPatch(result));
      toastManager.primary($ipt('usage_rights_bulk_saved', { count: ids.length }));
      assetMultiSelectManager.clear();
    } catch (error) {
      handleError(error, $ipt('usage_rights_save_failed'));
    }
  };

  const handleArea = async () => {
    if (!access) {
      return;
    }

    const ids = getSelectedIds();
    const areaId = await modalManager.show(AreaModal, {
      title: $ipt('change_area_title', { count: ids.length }),
      areas: getAssignableAreas(access),
    });
    if (!areaId) {
      return;
    }

    try {
      const { count } = await moveToMediaLibrary(ids, areaId);
      toastManager.primary($ipt('area_changed', { count }));
      assetMultiSelectManager.clear();
    } catch (error) {
      handleError(error, $ipt('move_to_library_failed'));
    }
  };

  const handleConfirm = async () => {
    try {
      const count = await confirmUsageRights(getSelectedIds());
      toastManager.primary($ipt('usage_rights_confirmed', { count }));
      assetMultiSelectManager.clear();
    } catch (error) {
      handleError(error, $ipt('usage_rights_confirm_failed'));
    }
  };

  const handleTrash = async () => {
    const ids = getSelectedIds();
    try {
      await deleteAssets({ assetBulkDeleteDto: { ids } });
      toastManager.primary($ipt('moved_to_trash', { count: ids.length }));
      assetMultiSelectManager.clear();
    } catch (error) {
      handleError(error, $ipt('move_to_trash_failed'));
    }
  };
</script>

{#if canEdit}
  <IconButton
    shape="round"
    color="secondary"
    variant="ghost"
    aria-label={$ipt('usage_rights_edit')}
    title={$ipt('usage_rights_edit')}
    icon={mdiCopyright}
    onclick={handleUsageRights}
  />
  {#if canConfirm}
    <IconButton
      shape="round"
      color="secondary"
      variant="ghost"
      aria-label={$ipt('usage_rights_confirm')}
      title={$ipt('usage_rights_confirm')}
      icon={mdiCheckDecagramOutline}
      onclick={handleConfirm}
    />
  {/if}
  {#if canMove}
    <IconButton
      shape="round"
      color="secondary"
      variant="ghost"
      aria-label={$ipt('change_area')}
      title={$ipt('change_area')}
      icon={mdiFolderMultipleImage}
      onclick={handleArea}
    />
  {/if}
  <IconButton
    shape="round"
    color="secondary"
    variant="ghost"
    aria-label={$ipt('move_to_trash')}
    title={$ipt('move_to_trash')}
    icon={mdiDeleteOutline}
    onclick={handleTrash}
  />
{/if}

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
  import { editKeywordsOfAssets } from '#lib/imagepier/keywords-bulk.ts';
  import {
    applyUsageRightsToAssets,
    confirmUsageRights,
    loadAssetDetails,
    toUsageRightsPatch,
  } from '#lib/imagepier/usage-rights.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { deleteAssets } from '@immich/sdk';
  import { IconButton, modalManager, toastManager } from '@immich/ui';
  import {
    mdiCheckDecagramOutline,
    mdiCopyright,
    mdiDeleteOutline,
    mdiFolderMultipleImage,
    mdiTagMultipleOutline,
  } from '@mdi/js';

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

  /** Selected assets the user may edit: externals only the assets they delivered, the others are skipped. */
  const getEditableIds = async () => {
    const ids = getSelectedIds();
    if (access?.role !== 'external') {
      return ids;
    }

    const details = await Promise.all(ids.map((id) => loadAssetDetails(id)));
    const own = ids.filter((_, index) => details[index].uploadedBy === authManager.user.id);
    if (own.length < ids.length) {
      toastManager.warning($ipt('only_own_deliveries', { count: ids.length - own.length }));
    }
    return own;
  };

  const handleUsageRights = async () => {
    const ids = await getEditableIds();
    if (ids.length === 0) {
      return;
    }

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

  const handleKeywords = async () => {
    const ids = await getEditableIds();
    if (ids.length > 0 && (await editKeywordsOfAssets(ids))) {
      assetMultiSelectManager.clear();
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
    const ids = await getEditableIds();
    if (ids.length === 0) {
      return;
    }

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
  <IconButton
    shape="round"
    color="secondary"
    variant="ghost"
    aria-label={$ipt('keywords_edit')}
    title={$ipt('keywords_edit')}
    icon={mdiTagMultipleOutline}
    onclick={handleKeywords}
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

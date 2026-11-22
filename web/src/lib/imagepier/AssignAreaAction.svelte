<script lang="ts">
  import MenuOption from '#lib/components/shared-components/context-menu/MenuOption.svelte';
  import AreaModal from '#lib/imagepier/AreaModal.svelte';
  import {
    canEditAreaOf,
    getAreaOfOwner,
    getAssignableAreas,
    getMediaLibraryAccess,
    isLibraryUser,
    moveToMediaLibrary,
    type MyAccess,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { eventManager } from '#lib/managers/event-manager.svelte.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { getAssetInfo, type AssetResponseDto } from '@immich/sdk';
  import { modalManager, toastManager } from '@immich/ui';
  import { mdiFolderMultipleImage } from '@mdi/js';

  /**
  Assigns the asset shown in the asset viewer to an area: own assets, and assets of areas where the user is editor
  or media manager. The server checks the levels again.
  */
  interface Props {
    asset: AssetResponseDto;
  }

  let { asset }: Props = $props();

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

  const currentArea = $derived(access ? getAreaOfOwner(access, asset.ownerId) : undefined);
  const isOwner = $derived(asset.ownerId === authManager.user.id);
  const targets = $derived(access ? getAssignableAreas(access).filter((area) => area.id !== currentArea?.id) : []);
  // Externals add own assets to areas, but do not move media library assets between areas.
  const canAssign = $derived(
    !!access &&
      !asset.isTrashed &&
      isLibraryUser(access, authManager.user.id) &&
      targets.length > 0 &&
      (isOwner || (!!currentArea && access.role !== 'external' && canEditAreaOf(access, currentArea.id))),
  );

  const handleAssign = async () => {
    const assetId = asset.id;
    const areaId = await modalManager.show(AreaModal, {
      title: currentArea ? $ipt('change_area_title', { count: 1 }) : $ipt('move_to_library_title', { count: 1 }),
      hint: currentArea ? undefined : $ipt('move_to_library_hint'),
      areas: targets,
    });
    if (!areaId) {
      return;
    }

    try {
      const { count } = await moveToMediaLibrary([assetId], areaId);
      toastManager.primary(currentArea ? $ipt('area_changed', { count }) : $ipt('move_to_library_done', { count }));
      eventManager.emit('AssetUpdate', await getAssetInfo({ id: assetId }));
    } catch (error) {
      handleError(error, $ipt('move_to_library_failed'));
    }
  };
</script>

{#if canAssign}
  <MenuOption
    text={currentArea ? $ipt('change_area') : $ipt('move_to_library')}
    icon={mdiFolderMultipleImage}
    onClick={() => handleAssign()}
  />
{/if}

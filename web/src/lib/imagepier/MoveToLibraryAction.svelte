<script lang="ts">
  import MenuOption from '#lib/components/shared-components/context-menu/MenuOption.svelte';
  import AreaModal from '#lib/imagepier/AreaModal.svelte';
  import {
    getAssignableAreas,
    getMediaLibraryAccess,
    moveToMediaLibrary,
    type MyAccess,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { getOwnedAssetsWithWarning } from '#lib/utils/asset-utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { modalManager, toastManager } from '@immich/ui';
  import { mdiFolderMultipleImage } from '@mdi/js';

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

  const isLibraryShared = $derived(!!access?.libraryUserId && access.libraryUserId !== authManager.user.id);
  // Needs the level editor in at least one area.
  const canMove = $derived(isLibraryShared && !!access && getAssignableAreas(access).length > 0);

  const handleMove = async () => {
    if (!access) {
      return;
    }

    const ids = getOwnedAssetsWithWarning(assetMultiSelectManager.assets, authManager.user);
    if (ids.length === 0) {
      return;
    }

    const areaId = await modalManager.show(AreaModal, {
      title: $ipt('move_to_library_title', { count: ids.length }),
      hint: $ipt('move_to_library_hint'),
      areas: getAssignableAreas(access),
    });
    if (!areaId) {
      return;
    }

    try {
      const { count } = await moveToMediaLibrary(ids, areaId);
      toastManager.primary($ipt('move_to_library_done', { count }));
      assetMultiSelectManager.clear();
    } catch (error) {
      handleError(error, $ipt('move_to_library_failed'));
    }
  };
</script>

{#if canMove}
  <MenuOption text={$ipt('move_to_library')} icon={mdiFolderMultipleImage} onClick={() => handleMove()} />
{/if}

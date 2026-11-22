<script lang="ts">
  import DeleteAction from '#lib/components/asset-viewer/actions/DeleteAction.svelte';
  import type { OnAction, PreAction } from '#lib/components/asset-viewer/actions/action.ts';
  import { canEditAreaOf, getMediaLibraryAccess } from '#lib/imagepier/access.ts';
  import { loadAssetDetails } from '#lib/imagepier/usage-rights.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import type { OnUndoDelete } from '#lib/utils/actions.ts';
  import type { AssetResponseDto } from '@immich/sdk';

  interface Props {
    asset: AssetResponseDto;
    onAction: OnAction;
    preAction: PreAction;
    onUndoDelete?: OnUndoDelete;
  }

  let { asset, onAction, preAction, onUndoDelete = undefined }: Props = $props();

  // Immich shows the delete button only to the owner; media library assets belong to the media library account.
  let allowedAssetId = $state<string>();

  const check = async (assetId: string, ownerId: string) => {
    if (!authManager.authenticated) {
      return;
    }

    try {
      const access = await getMediaLibraryAccess(authManager.user.id);
      if (!access?.libraryUserId || ownerId !== access.libraryUserId) {
        return;
      }
      const { areaId } = await loadAssetDetails(assetId);
      if (canEditAreaOf(access, areaId) && asset.id === assetId) {
        allowedAssetId = assetId;
      }
    } catch {
      allowedAssetId = undefined;
    }
  };

  $effect(() => {
    allowedAssetId = undefined;
    void check(asset.id, asset.ownerId);
  });
</script>

{#if allowedAssetId === asset.id}
  <DeleteAction {asset} {onAction} {preAction} {onUndoDelete} />
{/if}

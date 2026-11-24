<script lang="ts">
  import MenuOption from '#lib/components/shared-components/context-menu/MenuOption.svelte';
  import MoveToLibraryAction from '#lib/imagepier/MoveToLibraryAction.svelte';
  import UsageRightsModal from '#lib/imagepier/UsageRightsModal.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { editKeywordsOfAssets } from '#lib/imagepier/keywords-bulk.ts';
  import { applyUsageRightsToAssets, toUsageRightsPatch } from '#lib/imagepier/usage-rights.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { getOwnedAssetsWithWarning } from '#lib/utils/asset-utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { modalManager, toastManager } from '@immich/ui';
  import { mdiCopyright, mdiTagMultipleOutline } from '@mdi/js';

  interface Props {
    menuItem?: boolean;
  }

  let { menuItem = false }: Props = $props();

  const handleChangeUsageRights = async () => {
    const ids = getOwnedAssetsWithWarning(assetMultiSelectManager.assets, authManager.user);
    if (ids.length === 0) {
      return;
    }

    const result = await modalManager.show(UsageRightsModal, {
      title: $ipt('usage_rights_bulk_title', { count: ids.length }),
      hint: $ipt('usage_rights_bulk_hint'),
      bulk: true,
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
    const ids = getOwnedAssetsWithWarning(assetMultiSelectManager.assets, authManager.user);
    if (ids.length > 0 && (await editKeywordsOfAssets(ids))) {
      assetMultiSelectManager.clear();
    }
  };
</script>

{#if menuItem}
  <MenuOption text={$ipt('usage_rights_edit')} icon={mdiCopyright} onClick={() => handleChangeUsageRights()} />
  <MenuOption text={$ipt('keywords_edit')} icon={mdiTagMultipleOutline} onClick={() => handleKeywords()} />
  <MoveToLibraryAction />
{/if}

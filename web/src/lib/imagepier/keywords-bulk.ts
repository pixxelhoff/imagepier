import KeywordsModal from '#lib/imagepier/KeywordsModal.svelte';
import { ipt } from '#lib/imagepier/i18n.ts';
import { getKeywords, updateAssetKeywords } from '#lib/imagepier/keywords.ts';
import { handleError } from '#lib/utils/handle-error.ts';
import { modalManager, toastManager } from '@immich/ui';
import { get } from 'svelte/store';

/** Adds or removes keywords of several assets. Returns whether keywords were changed. */
export const editKeywordsOfAssets = async (assetIds: string[]) => {
  const translate = get(ipt);
  try {
    const keywords = await getKeywords();
    const change = await modalManager.show(KeywordsModal, {
      keywords,
      bulk: true,
      title: translate('keywords_bulk_title', { count: assetIds.length }),
    });
    if (!change || change.add.length + change.remove.length === 0) {
      return false;
    }

    await updateAssetKeywords(assetIds, change.add, change.remove);
    toastManager.primary(translate('keywords_bulk_saved', { count: assetIds.length }));
    return true;
  } catch (error) {
    handleError(error, translate('keywords_save_failed'));
    return false;
  }
};

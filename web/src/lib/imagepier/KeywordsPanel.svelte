<script lang="ts">
  import KeywordsModal from '#lib/imagepier/KeywordsModal.svelte';
  import { canEditAreaOf, getAreaOfOwner, getMediaLibraryAccess, type MyAccess } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    getAssetKeywords,
    getKeywords,
    splitKeywordValue,
    updateAssetKeywords,
    type Keyword,
  } from '#lib/imagepier/keywords.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import type { AssetResponseDto } from '@immich/sdk';
  import { Icon, IconButton, Text, modalManager } from '@immich/ui';
  import { mdiPencilOutline, mdiTagMultipleOutline } from '@mdi/js';
  import { onMount } from 'svelte';

  interface Props {
    asset: AssetResponseDto;
    isOwner: boolean;
  }

  let { asset, isOwner }: Props = $props();

  let keywords = $state<Keyword[]>([]);
  let values = $state<string[]>([]);
  let loadedAssetId = $state<string | undefined>();
  let access = $state<MyAccess>();

  onMount(() => {
    getKeywords()
      .then((result) => {
        keywords = result;
      })
      .catch((error: unknown) => console.error($ipt('keywords_load_failed'), error));
  });

  $effect(() => {
    const assetId = asset.id;
    values = [];
    loadedAssetId = undefined;

    getAssetKeywords(assetId)
      .then((result) => {
        if (asset.id === assetId) {
          values = result;
          loadedAssetId = assetId;
        }
      })
      .catch((error: unknown) => console.error($ipt('keywords_load_failed'), error));
  });

  // Media library assets belong to another account; only then the access of the user is needed.
  const loadAccess = async (userId: string) => {
    try {
      access = await getMediaLibraryAccess(userId);
    } catch {
      access = undefined;
    }
  };

  $effect(() => {
    if (!isOwner) {
      void loadAccess(authManager.user.id);
    }
  });

  const area = $derived(access ? getAreaOfOwner(access, asset.ownerId) : undefined);
  const canEdit = $derived(isOwner || (!!access && !!area && canEditAreaOf(access, area.id)));
  const hasKeywords = $derived(keywords.some((keyword) => keyword.active));

  const groups = $derived.by(() => {
    const byCategory: Record<string, string[]> = {};
    for (const value of values) {
      const { category, name } = splitKeywordValue(value);
      byCategory[category] = [...(byCategory[category] ?? []), name];
    }
    return Object.entries(byCategory).map(([category, names]) => ({ category, names }));
  });

  const handleEdit = async () => {
    const change = await modalManager.show(KeywordsModal, { keywords, selected: values });
    if (!change || change.add.length + change.remove.length === 0) {
      return;
    }

    try {
      await updateAssetKeywords([asset.id], change.add, change.remove);
      values = await getAssetKeywords(asset.id);
    } catch (error) {
      handleError(error, $ipt('keywords_save_failed'));
    }
  };
</script>

{#if loadedAssetId === asset.id && (values.length > 0 || (canEdit && hasKeywords))}
  <section class="px-4 pt-6" data-testid="imagepier-keywords">
    <div class="flex h-10 w-full items-center justify-between text-sm">
      <Text size="small" color="muted">{$ipt('keywords')}</Text>
      {#if canEdit && hasKeywords}
        <IconButton
          shape="round"
          color="secondary"
          variant="ghost"
          icon={mdiPencilOutline}
          aria-label={$ipt('keywords_edit')}
          title={$ipt('keywords_edit')}
          onclick={handleEdit}
        />
      {/if}
    </div>

    {#if values.length === 0}
      <Text size="small" color="muted">{$ipt('keywords_none')}</Text>
    {:else}
      <div class="flex gap-4 py-2">
        <div><Icon icon={mdiTagMultipleOutline} size="24" /></div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {#each groups as group (group.category)}
            <dt class="opacity-60">{group.category}</dt>
            <dd>{group.names.join(', ')}</dd>
          {/each}
        </dl>
      </div>
    {/if}
  </section>
{/if}

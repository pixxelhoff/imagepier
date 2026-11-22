<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import AssetSelectControlBar from '#lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '#lib/components/timeline/Timeline.svelte';
  import DownloadAction from '#lib/components/timeline/actions/DownloadAction.svelte';
  import MediaLibraryActions from '#lib/imagepier/MediaLibraryActions.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { getAssetBulkActions } from '#lib/services/asset.service.ts';
  import { AssetVisibility } from '@immich/sdk';
  import { ActionButton, CommandPaletteDefaultProvider, Text } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const area = $derived(data.area);
  const options = $derived(
    area?.tagId
      ? { userId: area.libraryUserId, tagId: area.tagId, visibility: AssetVisibility.Timeline, withStacked: true }
      : undefined,
  );
  const actions = $derived(getAssetBulkActions($t));

  const handleEscape = () => {
    if (assetMultiSelectManager.selectionActive) {
      assetMultiSelectManager.clear();
    }
  };
</script>

<UserPageLayout title={data.meta.title} hideNavbar={assetMultiSelectManager.selectionActive} scrollbar={false}>
  {#if !area}
    <Text class="m-6" color="muted">{$ipt('area_not_found')}</Text>
  {:else if !options}
    <Text class="m-6" color="muted">{$ipt('area_empty')}</Text>
  {:else}
    <Timeline enableRouting={true} {options} assetInteraction={assetMultiSelectManager} onEscape={handleEscape} />
  {/if}
</UserPageLayout>

{#if area && assetMultiSelectManager.selectionActive}
  <AssetSelectControlBar>
    <CommandPaletteDefaultProvider name={$t('assets')} actions={Object.values(actions)} />
    <ActionButton action={actions.CreateSharedLink} />
    <ActionButton action={actions.AddToAlbum} />
    <DownloadAction />
    <MediaLibraryActions ownerId={area.libraryUserId} />
  </AssetSelectControlBar>
{/if}

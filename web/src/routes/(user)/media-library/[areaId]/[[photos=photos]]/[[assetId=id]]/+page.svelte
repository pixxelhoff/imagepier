<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import AssetSelectControlBar from '#lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '#lib/components/timeline/Timeline.svelte';
  import DownloadAction from '#lib/components/timeline/actions/DownloadAction.svelte';
  import MediaLibraryActions from '#lib/imagepier/MediaLibraryActions.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { uploadAccess } from '#lib/imagepier/upload-access.svelte.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { getAssetBulkActions } from '#lib/services/asset.service.ts';
  import { AssetVisibility } from '@immich/sdk';
  import { ActionButton, CommandPaletteDefaultProvider, Text, toastManager } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const area = $derived(data.area);
  // The area view is the timeline of the area account, which is shared with the user.
  const options = $derived(
    area?.userId ? { userId: area.userId, visibility: AssetVisibility.Timeline, withStacked: true } : undefined,
  );
  const actions = $derived(getAssetBulkActions($t));

  // Increased after an upload, so the timeline of the area is loaded again.
  let timelineKey = $state(0);

  // Uploads in this view (upload button, drag and drop) are assigned to the area right away.
  $effect(() => {
    if (!area?.canUpload || !area.userId) {
      return;
    }

    uploadAccess.target = {
      areaId: area.id,
      onAssigned: (count) => {
        toastManager.primary($ipt('upload_to_area_done', { count }));
        timelineKey++;
      },
    };
    return () => {
      uploadAccess.target = undefined;
    };
  });

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
    {#key timelineKey}
      <Timeline enableRouting={true} {options} assetInteraction={assetMultiSelectManager} onEscape={handleEscape} />
    {/key}
  {/if}
</UserPageLayout>

{#if area && assetMultiSelectManager.selectionActive}
  <AssetSelectControlBar>
    <CommandPaletteDefaultProvider name={$t('assets')} actions={Object.values(actions)} />
    <ActionButton action={actions.CreateSharedLink} />
    <ActionButton action={actions.AddToAlbum} />
    <DownloadAction />
    {#if area.userId}
      <MediaLibraryActions ownerId={area.userId} />
    {/if}
  </AssetSelectControlBar>
{/if}

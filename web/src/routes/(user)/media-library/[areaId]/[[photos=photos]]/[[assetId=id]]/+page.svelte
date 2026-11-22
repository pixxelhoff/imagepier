<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import AssetSelectControlBar from '#lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '#lib/components/timeline/Timeline.svelte';
  import DownloadAction from '#lib/components/timeline/actions/DownloadAction.svelte';
  import MediaLibraryActions from '#lib/imagepier/MediaLibraryActions.svelte';
  import { moveToMediaLibrary } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { getAssetBulkActions } from '#lib/services/asset.service.ts';
  import { openFileUploadDialog } from '#lib/utils/file-uploader.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { AssetVisibility } from '@immich/sdk';
  import { ActionButton, Button, CommandPaletteDefaultProvider, Text, toastManager } from '@immich/ui';
  import { mdiTrayArrowUp } from '@mdi/js';
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

  /** Uploads files as own assets of the user and assigns them to the area right away. */
  const handleUpload = async () => {
    if (!area) {
      return;
    }

    const areaId = area.id;
    const assetIds = await openFileUploadDialog();
    if (assetIds.length === 0) {
      return;
    }

    try {
      const { count } = await moveToMediaLibrary(assetIds, areaId);
      toastManager.primary($ipt('upload_to_area_done', { count }));
      timelineKey++;
    } catch (error) {
      handleError(error, $ipt('upload_to_area_failed'));
    }
  };

  const handleEscape = () => {
    if (assetMultiSelectManager.selectionActive) {
      assetMultiSelectManager.clear();
    }
  };
</script>

<UserPageLayout title={data.meta.title} hideNavbar={assetMultiSelectManager.selectionActive} scrollbar={false}>
  {#snippet buttons()}
    {#if area?.canUpload && area.userId}
      <Button
        leadingIcon={mdiTrayArrowUp}
        onclick={() => void handleUpload()}
        size="small"
        variant="ghost"
        color="secondary"
      >
        <Text class="hidden md:block">{$ipt('upload_to_area')}</Text>
      </Button>
    {/if}
  {/snippet}

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

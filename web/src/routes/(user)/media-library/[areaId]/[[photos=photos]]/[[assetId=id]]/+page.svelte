<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import AssetSelectControlBar from '#lib/components/timeline/AssetSelectControlBar.svelte';
  import Timeline from '#lib/components/timeline/Timeline.svelte';
  import DownloadAction from '#lib/components/timeline/actions/DownloadAction.svelte';
  import MediaLibraryActions from '#lib/imagepier/MediaLibraryActions.svelte';
  import { getLibraryTags, getMediaLibraryAccess } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { getUsageRightsConfig } from '#lib/imagepier/usage-rights.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { getAssetBulkActions } from '#lib/services/asset.service.ts';
  import { AssetVisibility } from '@immich/sdk';
  import { ActionButton, CommandPaletteDefaultProvider, Text } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  type AreaView = { name: string; libraryUserId: string; tagId?: string };

  let area = $state<AreaView>();
  let failed = $state(false);

  const loadArea = async (areaId: string) => {
    try {
      const access = await getMediaLibraryAccess(authManager.user.id);
      const found = access?.allAreas.find((item) => item.id === areaId);
      if (!access?.canViewLibrary || !access.libraryUserId || !found) {
        failed = true;
        return;
      }

      const [config, tags] = await Promise.all([getUsageRightsConfig(), getLibraryTags()]);
      const value = `${config.tags.area}/${found.name}`;
      area = {
        name: found.name,
        libraryUserId: access.libraryUserId,
        tagId: tags.find((tag) => tag.value === value)?.id,
      };
      failed = false;
    } catch {
      failed = true;
    }
  };

  $effect(() => {
    area = undefined;
    void loadArea(data.areaId);
  });

  const options = $derived(
    area?.tagId
      ? { userId: area.libraryUserId, tagId: area.tagId, visibility: AssetVisibility.Timeline, withStacked: true }
      : undefined,
  );

  const title = $derived(area ? $ipt('photos_area', { name: area.name }) : $ipt('media_library'));
  const actions = $derived(getAssetBulkActions($t));

  const handleEscape = () => {
    if (assetMultiSelectManager.selectionActive) {
      assetMultiSelectManager.clear();
    }
  };
</script>

<UserPageLayout {title} hideNavbar={assetMultiSelectManager.selectionActive} scrollbar={false}>
  {#if failed}
    <Text class="m-6" color="muted">{$ipt('area_not_found')}</Text>
  {:else if area && !options}
    <Text class="m-6" color="muted">{$ipt('area_empty')}</Text>
  {:else if area && options}
    {#key options.tagId}
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
    <MediaLibraryActions ownerId={area.libraryUserId} />
  </AssetSelectControlBar>
{/if}

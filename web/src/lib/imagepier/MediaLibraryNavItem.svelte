<script lang="ts">
  import { canPublishGalleries, getMediaLibraryAccess, getVisibleAreas, type MyAccess } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { photosScope, type PhotosScope } from '#lib/imagepier/photos-scope.svelte.ts';
  import { uploadAccess } from '#lib/imagepier/upload-access.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { Route } from '#lib/route.ts';
  import { NavbarItem } from '@immich/ui';
  import { mdiWeb } from '@mdi/js';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  let access = $state<MyAccess>();

  const loadAccess = async (userId: string) => {
    try {
      access = await getMediaLibraryAccess(userId);
      // Everybody can upload own photos; uploads into areas need the level editor.
      uploadAccess.allowed = true;
    } catch {
      access = undefined;
    }
  };

  $effect(() => {
    void loadAccess(authManager.user.id);
  });

  const showLibrary = $derived(
    !!access?.canViewLibrary && !!access.libraryUserId && access.libraryUserId !== authManager.user.id,
  );

  // Only areas with a level are shown.
  const areas = $derived(showLibrary && access ? getVisibleAreas(access) : []);

  const isPhotosPage = $derived(page.url.pathname.startsWith(Route.photos()));

  const isAreaPage = (areaId: string) => page.url.pathname.startsWith(`/media-library/${encodeURIComponent(areaId)}`);

  const showPhotos = async (scope: PhotosScope) => {
    photosScope.set(scope);
    if (!isPhotosPage) {
      await goto(Route.photos());
    }
  };

  const itemClass = (active: boolean) => [
    'block w-full truncate rounded-full px-4 py-1.5 text-start text-sm hover:bg-gray-200/60 dark:hover:bg-gray-700/60',
    active && 'font-medium text-primary',
  ];
</script>

{#if showLibrary}
  <div class="flex flex-col gap-0.5 ps-10 pe-2 pb-1" data-testid="imagepier-photos-nav">
    <button
      type="button"
      class={itemClass(isPhotosPage && photosScope.value === 'own')}
      onclick={() => void showPhotos('own')}
    >
      {$ipt('photos_own')}
    </button>
    <button
      type="button"
      class={itemClass(isPhotosPage && photosScope.value === 'all')}
      onclick={() => void showPhotos('all')}
    >
      {$ipt('photos_all')}
    </button>
    {#each areas as area (area.id)}
      <a href={`/media-library/${encodeURIComponent(area.id)}`} class={itemClass(isAreaPage(area.id))}>
        {$ipt('photos_area', { name: area.name })}
      </a>
    {/each}
  </div>
  {#if access && canPublishGalleries(access)}
    <NavbarItem title={$ipt('website_galleries')} href="/galleries" icon={mdiWeb} />
  {/if}
{/if}

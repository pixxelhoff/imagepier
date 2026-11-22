<script lang="ts">
  import { getMediaLibraryAccess, type MyAccess } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { Route } from '#lib/route.ts';
  import { NavbarItem } from '@immich/ui';
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

  const libraryUserId = $derived(
    access?.canViewLibrary && access.libraryUserId !== authManager.user.id ? access.libraryUserId : null,
  );
</script>

{#if libraryUserId}
  <NavbarItem
    title={$ipt('media_library')}
    href={Route.viewPartner({ id: libraryUserId })}
    icon={mdiFolderMultipleImage}
  />
{/if}

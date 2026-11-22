<script lang="ts">
  import { getMediaLibraryAccess, type MyAccess } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { Route } from '#lib/route.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { PartnerDirection, getPartners, updatePartner } from '@immich/sdk';
  import { NavbarItem, Switch, Text } from '@immich/ui';
  import { mdiFolderMultipleImage } from '@mdi/js';

  let access = $state<MyAccess>();
  let inTimeline = $state<boolean>();

  const loadAccess = async (userId: string) => {
    try {
      access = await getMediaLibraryAccess(userId);
      const libraryId = access?.libraryUserId;
      if (libraryId) {
        const partners = await getPartners({ direction: PartnerDirection.SharedWith });
        inTimeline = partners.find((partner) => partner.id === libraryId)?.inTimeline;
      }
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

  // The media library is a partner; "in timeline" decides whether its assets are shown under Photos.
  const setInTimeline = async (value: boolean) => {
    if (!libraryUserId) {
      return;
    }

    try {
      await updatePartner({ id: libraryUserId, partnerUpdateDto: { inTimeline: value } });
      inTimeline = value;
      if (location.pathname.startsWith(Route.photos())) {
        location.reload();
      }
    } catch (error) {
      handleError(error, $ipt('media_library_in_photos_failed'));
    }
  };
</script>

{#if libraryUserId}
  <NavbarItem
    title={$ipt('media_library')}
    href={Route.viewPartner({ id: libraryUserId })}
    icon={mdiFolderMultipleImage}
  />
  {#if inTimeline !== undefined}
    <div class="flex items-center justify-between gap-2 py-1 ps-12 pe-4" data-testid="imagepier-library-in-photos">
      <Text size="small" color="muted">{$ipt('media_library_in_photos')}</Text>
      <Switch bind:checked={() => inTimeline ?? false, (value) => void setInTimeline(value)} />
    </div>
  {/if}
{/if}

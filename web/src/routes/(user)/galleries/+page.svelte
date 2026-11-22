<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import GalleryBrandingAdmin from '#lib/imagepier/GalleryBrandingAdmin.svelte';
  import GalleryManager from '#lib/imagepier/GalleryManager.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { Heading, Stack } from '@immich/ui';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
</script>

<UserPageLayout title={data.meta.title}>
  <div class="m-auto w-full max-w-3xl py-5">
    <Stack gap={8}>
      <GalleryManager />
      {#if authManager.user.isAdmin}
        <section>
          <Heading size="tiny" tag="h2" class="mb-4">{$ipt('gallery_branding')}</Heading>
          <GalleryBrandingAdmin />
        </section>
      {/if}
    </Stack>
  </div>
</UserPageLayout>

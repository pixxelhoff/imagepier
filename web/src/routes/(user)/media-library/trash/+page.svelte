<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import MediaLibraryTrash from '#lib/imagepier/MediaLibraryTrash.svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
</script>

<UserPageLayout title={data.meta.title}>
  <div class="m-auto w-full max-w-3xl py-5">
    <MediaLibraryTrash />
  </div>
</UserPageLayout>

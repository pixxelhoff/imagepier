<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import ImportPage from '#lib/imagepier/ImportPage.svelte';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
</script>

<UserPageLayout title={data.meta.title}>
  <div class="m-auto w-full max-w-5xl py-5">
    <ImportPage />
  </div>
</UserPageLayout>

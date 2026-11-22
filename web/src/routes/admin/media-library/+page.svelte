<script lang="ts">
  import AdminPageLayout from '#lib/components/layouts/AdminPageLayout.svelte';
  import MediaLibraryAdmin from '#lib/imagepier/MediaLibraryAdmin.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { Container, Heading } from '@immich/ui';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  const { data }: Props = $props();
</script>

<AdminPageLayout breadcrumbs={[{ title: data.meta.title }]}>
  <Container size="medium" center>
    <section>
      <Heading size="tiny" tag="h2" class="mb-4">{$ipt('areas')}</Heading>
      <MediaLibraryAdmin />
    </section>
  </Container>
</AdminPageLayout>

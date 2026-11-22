<script lang="ts">
  import AdminPageLayout from '#lib/components/layouts/AdminPageLayout.svelte';
  import AuditLogAdmin from '#lib/imagepier/AuditLogAdmin.svelte';
  import MediaLibraryAdmin from '#lib/imagepier/MediaLibraryAdmin.svelte';
  import MediaLibraryTrash from '#lib/imagepier/MediaLibraryTrash.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { Container, Heading, Stack } from '@immich/ui';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  const { data }: Props = $props();
</script>

<AdminPageLayout breadcrumbs={[{ title: data.meta.title }]}>
  <Container size="medium" center>
    <Stack gap={8}>
      <section>
        <Heading size="tiny" tag="h2" class="mb-4">{$ipt('areas')}</Heading>
        <MediaLibraryAdmin />
      </section>

      <section>
        <Heading size="tiny" tag="h2" class="mb-4">{$ipt('library_trash_title')}</Heading>
        <MediaLibraryTrash />
      </section>

      <section>
        <Heading size="tiny" tag="h2" class="mb-4">{$ipt('audit_title')}</Heading>
        <AuditLogAdmin />
      </section>
    </Stack>
  </Container>
</AdminPageLayout>

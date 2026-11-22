<script lang="ts">
  import AdminPageLayout from '#lib/components/layouts/AdminPageLayout.svelte';
  import AuditLogAdmin from '#lib/imagepier/AuditLogAdmin.svelte';
  import { Container } from '@immich/ui';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  const { data }: Props = $props();
</script>

<AdminPageLayout breadcrumbs={[{ title: data.meta.title }]}>
  <Container size="large" center>
    <AuditLogAdmin />
  </Container>
</AdminPageLayout>

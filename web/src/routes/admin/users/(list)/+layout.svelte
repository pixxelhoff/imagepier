<script lang="ts">
  import AdminPageLayout from '#lib/components/layouts/AdminPageLayout.svelte';
  import UserListAdmin from '#lib/imagepier/UserListAdmin.svelte';
  import { createPreloadedQuery } from '#lib/queries/client.ts';
  import { searchUsersAdminQuery } from '#lib/queries/user-admin.query.ts';
  import { getUserAdminActions, getUserAdminsActions } from '#lib/services/user-admin.service.ts';
  import type { UserAdminResponseDto } from '@immich/sdk';
  import { CommandPaletteDefaultProvider, Container, MenuItemType } from '@immich/ui';
  import type { Snippet } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { LayoutData } from './$types';

  type Props = {
    children?: Snippet;
    data: LayoutData;
  };

  let { children, data }: Props = $props();

  const query = createPreloadedQuery(() => searchUsersAdminQuery({ withDeleted: true }));
  const users = $derived(query.data);

  const { Create } = $derived(getUserAdminsActions($t));

  const getActionsForUser = (user: UserAdminResponseDto) => {
    const { Detail, Update, Delete, Restore, ResetPassword, ResetPinCode } = getUserAdminActions($t, user);
    return [Detail, Update, ResetPassword, ResetPinCode, MenuItemType.Divider, Restore, Delete];
  };
</script>

<CommandPaletteDefaultProvider name={$t('users')} actions={[Create]} />

<AdminPageLayout breadcrumbs={[{ title: data.meta.title }]} actions={[Create]}>
  <Container center size="large">
    <!-- ImagePier: user list with role, filter and sorting -->
    <UserListAdmin {users} getActions={getActionsForUser} />

    {@render children?.()}
  </Container>
</AdminPageLayout>

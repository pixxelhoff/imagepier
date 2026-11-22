<script lang="ts">
  import { getUserRolesAdmin, type UserListRole } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { Route } from '#lib/route.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { getByteUnitString } from '#lib/utils/byte-units.ts';
  import type { UserAdminResponseDto } from '@immich/sdk';
  import {
    Badge,
    ContextMenuButton,
    Icon,
    Input,
    Link,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
  } from '@immich/ui';
  import { mdiArrowDown, mdiArrowUp, mdiInfinity } from '@mdi/js';
  import { onMount, type ComponentProps } from 'svelte';
  import { t } from 'svelte-i18n';

  type SortKey = 'name' | 'email' | 'role';

  interface Props {
    users: UserAdminResponseDto[];
    getActions: (user: UserAdminResponseDto) => ComponentProps<typeof ContextMenuButton>['items'];
  }

  let { users, getActions }: Props = $props();

  const ROLE_ORDER: UserListRole[] = ['admin', 'manager', 'staff', 'external', 'library'];
  const ROLE_COLORS = {
    admin: 'danger',
    manager: 'primary',
    staff: 'success',
    external: 'warning',
    library: 'info',
  } as const;

  let roles = $state<Record<string, UserListRole>>({});
  let search = $state('');
  let roleFilter = $state('');
  let sortKey = $state<SortKey>('name');
  let descending = $state(false);

  onMount(() => {
    void getUserRolesAdmin()
      .then((value) => (roles = value))
      .catch(() => (roles = {}));
  });

  const getRole = (user: UserAdminResponseDto): UserListRole => roles[user.id] ?? (user.isAdmin ? 'admin' : 'staff');

  const getRoleLabel = (role: UserListRole) => (role === 'library' ? $ipt('media_library') : $ipt(`role.${role}`));

  const roleOptions = $derived([
    { label: $ipt('users_role_all'), value: '' },
    ...ROLE_ORDER.map((role) => ({ label: getRoleLabel(role), value: role })),
  ]);

  const getRoleFilter = () => roleFilter;
  const setRoleFilter = (value: string) => (roleFilter = value);

  const compare = (a: UserAdminResponseDto, b: UserAdminResponseDto) => {
    switch (sortKey) {
      case 'email': {
        return a.email.localeCompare(b.email, $locale);
      }
      case 'role': {
        const order = ROLE_ORDER.indexOf(getRole(a)) - ROLE_ORDER.indexOf(getRole(b));
        return order === 0 ? a.name.localeCompare(b.name, $locale, { sensitivity: 'base' }) : order;
      }
      default: {
        return a.name.localeCompare(b.name, $locale, { sensitivity: 'base' });
      }
    }
  };

  const visibleUsers = $derived.by(() => {
    const term = search.trim().toLowerCase();
    const result = users.filter(
      (user) =>
        (!term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)) &&
        (!roleFilter || getRole(user) === roleFilter),
    );
    result.sort(compare);
    if (descending) {
      result.reverse();
    }
    return result;
  });

  const sortBy = (key: SortKey) => {
    if (sortKey === key) {
      descending = !descending;
    } else {
      sortKey = key;
      descending = false;
    }
  };

  const classes = {
    name: 'w-7/12 md:w-4/12 lg:w-3/12',
    email: 'hidden md:block md:w-4/12',
    role: 'w-4/12 md:w-3/12 lg:w-2/12',
    quota: 'hidden lg:block lg:w-2/12',
    actions: 'w-1/12 flex justify-end',
  };
</script>

{#snippet heading(key: SortKey, label: string)}
  <button type="button" class="inline-flex items-center gap-1" onclick={() => sortBy(key)}>
    {label}
    {#if sortKey === key}
      <Icon icon={descending ? mdiArrowDown : mdiArrowUp} size="16" />
    {/if}
  </button>
{/snippet}

<div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
  <div class="grow">
    <Input bind:value={search} placeholder={$ipt('users_search')} aria-label={$ipt('users_search')} />
  </div>
  <div class="md:w-64">
    <Select options={roleOptions} bind:value={getRoleFilter, setRoleFilter} />
  </div>
</div>
<p class="mt-2 text-sm text-gray-500">
  {$ipt('users_count', { count: visibleUsers.length, total: users.length })}
</p>

<Table class="mt-4" striped spacing="small" size="small">
  <TableHeader>
    <TableHeading class={classes.name}>{@render heading('name', $t('name'))}</TableHeading>
    <TableHeading class={classes.email}>{@render heading('email', $t('email'))}</TableHeading>
    <TableHeading class={classes.role}>{@render heading('role', $ipt('role'))}</TableHeading>
    <TableHeading class={classes.quota}>{$t('has_quota')}</TableHeading>
  </TableHeader>

  <TableBody>
    {#each visibleUsers as user (user.id)}
      <TableRow color={user.deletedAt ? 'danger' : undefined}>
        <TableCell class={classes.name}>
          <Link href={Route.viewUser(user)}>{user.name}</Link>
        </TableCell>
        <TableCell class={classes.email}>{user.email}</TableCell>
        <TableCell class={classes.role}>
          <Badge size="small" shape="round" color={ROLE_COLORS[getRole(user)]}>{getRoleLabel(getRole(user))}</Badge>
        </TableCell>
        <TableCell class={classes.quota}>
          <div class="container mx-auto flex flex-wrap justify-center">
            {#if user.quotaSizeInBytes !== null && user.quotaSizeInBytes >= 0}
              {getByteUnitString(user.quotaSizeInBytes, $locale)}
            {:else}
              <Icon icon={mdiInfinity} size="16" />
            {/if}
          </div>
        </TableCell>
        <TableCell class={classes.actions}>
          <ContextMenuButton color="primary" aria-label={$t('open')} items={getActions(user)} />
        </TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>

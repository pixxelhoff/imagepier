<script lang="ts">
  import AdminCard from '#lib/components/AdminCard.svelte';
  import {
    AREA_LEVELS,
    ASSIGNABLE_ROLES,
    getUserAccessAdmin,
    updateUserAccessAdmin,
    type AreaLevel,
    type AssignableRole,
    type StoredUserAccess,
    type UserAccessAdmin,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { Field, HelperText, Label, Select, Stack, Text, toastManager } from '@immich/ui';
  import { mdiShieldAccountOutline } from '@mdi/js';

  type Props = {
    userId: string;
  };

  const { userId }: Props = $props();

  let data = $state<UserAccessAdmin>();
  let failed = $state(false);

  const load = async (id: string) => {
    try {
      data = await getUserAccessAdmin(id);
      failed = false;
    } catch {
      failed = true;
    }
  };

  $effect(() => {
    void load(userId);
  });

  const save = async (dto: StoredUserAccess) => {
    try {
      data = await updateUserAccessAdmin(userId, dto);
      toastManager.primary($ipt('access_saved'));
    } catch (error) {
      handleError(error, $ipt('access_save_failed'));
    }
  };

  const getRole = () => (data?.effective.role ?? 'staff') as AssignableRole;
  const setRole = (role: string) => void save({ role: role as AssignableRole });

  const roleOptions = $derived(ASSIGNABLE_ROLES.map((role) => ({ label: $ipt(`role.${role}`), value: role })));

  // Externals cannot be media managers.
  const levelOptions = $derived([
    { label: $ipt('level.none'), value: '' },
    ...AREA_LEVELS.filter((level) => level !== 'manager' || data?.effective.role !== 'external').map((level) => ({
      label: $ipt(`level.${level}`),
      value: level,
    })),
  ]);

  const getLevel = (areaId: string) => data?.effective.areas[areaId] ?? '';

  const setLevel = (areaId: string, value: string) => {
    const level = AREA_LEVELS.find((item) => item === value);
    const entries: Array<[string, AreaLevel]> = Object.entries(data?.effective.areas ?? {}).filter(
      ([id]) => id !== areaId,
    );
    if (level) {
      entries.push([areaId, level]);
    }
    void save({ areas: Object.fromEntries(entries) });
  };
</script>

<AdminCard icon={mdiShieldAccountOutline} title={$ipt('access_title')}>
  {#if failed}
    <HelperText color="danger">{$ipt('access_load_failed')}</HelperText>
  {:else if data?.isLibrary}
    <Text color="muted">{$ipt('access_library_account')}</Text>
  {:else if data?.effective.role === 'admin'}
    <Stack gap={2}>
      <Text>{$ipt('role.admin')}</Text>
      <Text color="muted" size="small">{$ipt('access_admin_hint')}</Text>
    </Stack>
  {:else if data}
    <Stack gap={4}>
      <Field label={$ipt('role')}>
        <Select options={roleOptions} bind:value={getRole, setRole} />
      </Field>
      <div>
        <Label label={$ipt('areas')} />
        <Text size="small" color="muted">{$ipt('access_areas_hint')}</Text>
        <div class="mt-3 flex flex-col gap-2">
          {#each data.allAreas as area (area.id)}
            <div class="flex items-center gap-3">
              <Text class="min-w-0 grow truncate">{area.name}</Text>
              <div class="w-56 shrink-0">
                <Select
                  options={levelOptions}
                  bind:value={() => getLevel(area.id), (value) => setLevel(area.id, value)}
                />
              </div>
            </div>
          {/each}
        </div>
      </div>
    </Stack>
  {/if}
</AdminCard>

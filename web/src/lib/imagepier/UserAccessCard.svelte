<script lang="ts">
  import AdminCard from '#lib/components/AdminCard.svelte';
  import {
    ASSIGNABLE_ROLES,
    SHARED_AREA_ID,
    getUserAccessAdmin,
    updateUserAccessAdmin,
    type AssignableRole,
    type StoredUserAccess,
    type UserAccessAdmin,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { Checkbox, Field, HelperText, Label, Select, Stack, Switch, Text, toastManager } from '@immich/ui';
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
  const getCanUpload = () => data?.effective.canUpload ?? false;
  const setCanUpload = (canUpload: boolean) => void save({ canUpload });
  const getCanDownload = () => data?.effective.canDownload ?? false;
  const setCanDownload = (canDownload: boolean) => void save({ canDownload });

  const managerAreas = $derived(data?.allAreas.filter((area) => area.id !== SHARED_AREA_ID) ?? []);
  const hasArea = (areaId: string) => data?.effective.areas.includes(areaId) ?? false;
  const toggleArea = (areaId: string, checked: boolean) => {
    const current = (data?.effective.areas ?? []).filter((id) => id !== areaId);
    void save({ areas: checked ? [...current, areaId] : current });
  };

  const roleOptions = $derived(ASSIGNABLE_ROLES.map((role) => ({ label: $ipt(`role.${role}`), value: role })));
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
      {#if data.effective.role === 'manager' && managerAreas.length > 0}
        <div>
          <Label label={$ipt('responsible_areas')} />
          <div class="mt-2 flex flex-col gap-2">
            {#each managerAreas as area (area.id)}
              <div class="flex items-center gap-2">
                <Checkbox
                  id="imagepier-area-{area.id}"
                  size="tiny"
                  checked={hasArea(area.id)}
                  onCheckedChange={(checked) => toggleArea(area.id, checked)}
                />
                <Label label={area.name} for="imagepier-area-{area.id}" />
              </div>
            {/each}
          </div>
        </div>
      {/if}
      <Field label={$ipt('can_upload')}>
        <Switch bind:checked={getCanUpload, setCanUpload} />
      </Field>
      <Field label={$ipt('can_download')}>
        <Switch bind:checked={getCanDownload, setCanDownload} />
      </Field>
    </Stack>
  {/if}
</AdminCard>

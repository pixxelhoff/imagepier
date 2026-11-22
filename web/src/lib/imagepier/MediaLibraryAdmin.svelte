<script lang="ts">
  import { SHARED_AREA_ID, getAreasAdmin, updateAreasAdmin } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { Button, HelperText, IconButton, Input, Stack, Text, toastManager } from '@immich/ui';
  import { mdiDeleteOutline, mdiPlus } from '@mdi/js';
  import { onMount } from 'svelte';

  type EditableArea = { id?: string; name: string };

  let areas = $state<EditableArea[]>([]);
  let failed = $state(false);
  let saving = $state(false);

  const load = async () => {
    try {
      areas = await getAreasAdmin();
      failed = false;
    } catch {
      failed = true;
    }
  };

  onMount(() => {
    void load();
  });

  const addArea = () => {
    areas = [...areas, { name: '' }];
  };

  const removeArea = (index: number) => {
    areas = areas.filter((_, position) => position !== index);
  };

  const save = async () => {
    saving = true;
    try {
      areas = await updateAreasAdmin(areas.filter((area) => area.name.trim().length > 0));
      toastManager.primary($ipt('areas_saved'));
    } catch (error) {
      handleError(error, $ipt('areas_save_failed'));
    } finally {
      saving = false;
    }
  };
</script>

<Stack gap={4}>
  <Text color="muted">{$ipt('media_library_admin_description')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('areas_save_failed')}</HelperText>
  {:else}
    {#each areas as area, index (area.id ?? `new-${index}`)}
      <div class="flex items-center gap-2">
        <div class="grow">
          <Input bind:value={area.name} aria-label={$ipt('area_name')} placeholder={$ipt('area_name')} />
        </div>
        {#if area.id === SHARED_AREA_ID}
          <Text size="small" color="muted" class="w-64">{$ipt('area_shared_hint')}</Text>
        {:else}
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            aria-label={$ipt('area_remove')}
            icon={mdiDeleteOutline}
            onclick={() => removeArea(index)}
          />
        {/if}
      </div>
    {/each}

    <div class="flex gap-2">
      <Button variant="ghost" leadingIcon={mdiPlus} onclick={addArea}>{$ipt('area_add')}</Button>
      <Button onclick={save} loading={saving}>{$ipt('save')}</Button>
    </div>

    <Text size="small" color="muted">{$ipt('areas_rename_hint')}</Text>
  {/if}
</Stack>

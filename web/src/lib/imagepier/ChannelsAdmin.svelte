<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { getChannels, updateChannelsAdmin, type Channel } from '#lib/imagepier/usage-rights.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { Button, Checkbox, HelperText, Input, Stack, Text, toastManager } from '@immich/ui';
  import { mdiPlus } from '@mdi/js';
  import { onMount } from 'svelte';

  /** Rows of the form; new channels have no id until they are saved. */
  type Row = { id?: string; label: string; active: boolean };

  let rows = $state<Row[]>([]);
  let failed = $state(false);
  let saving = $state(false);

  onMount(async () => {
    try {
      rows = (await getChannels()).map((channel: Channel) => ({ ...channel }));
    } catch {
      failed = true;
    }
  });

  const addRow = () => {
    rows = [...rows, { label: '', active: true }];
  };

  const save = async () => {
    saving = true;
    try {
      const channels = await updateChannelsAdmin(rows.filter((row) => row.label.trim()));
      rows = channels.map((channel) => ({ ...channel }));
      toastManager.primary($ipt('channels_saved'));
    } catch (error) {
      handleError(error, $ipt('channels_save_failed'));
    } finally {
      saving = false;
    }
  };
</script>

<Stack gap={4}>
  <Text size="small" color="muted">{$ipt('channels_hint')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('channels_load_failed')}</HelperText>
  {:else}
    <div class="flex flex-col gap-2">
      {#each rows as row, index (row.id ?? `new-${index}`)}
        <div class="flex items-center gap-3">
          <div class="grow">
            <Input
              bind:value={row.label}
              placeholder={$ipt('channel_new')}
              aria-label={$ipt('channel_label')}
            />
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Checkbox
              id="imagepier-channel-{index}"
              size="tiny"
              checked={row.active}
              onCheckedChange={(checked) => (row.active = checked)}
            />
            <label for="imagepier-channel-{index}" class="text-sm">{$ipt('channel_active')}</label>
          </div>
        </div>
      {/each}
    </div>

    <div class="flex gap-2">
      <Button size="small" variant="ghost" leadingIcon={mdiPlus} onclick={addRow}>{$ipt('channel_add')}</Button>
      <Button size="small" onclick={save} loading={saving} disabled={saving}>{$ipt('save')}</Button>
    </div>
  {/if}
</Stack>

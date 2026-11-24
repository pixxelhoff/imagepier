<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    CHANNEL_VALUES,
    LICENSE_TYPES,
    RELEASE_STATUSES,
    USAGE_RIGHTS_VERSION,
    getChannelValue,
    getChannels,
    type Channel,
    type ChannelValue,
    type UsageRights,
    type UsageRightsInput,
  } from '#lib/imagepier/usage-rights.ts';
  import { Button, DatePicker, Field, FormModal, Input, Label, Select, Stack, Text, Textarea } from '@immich/ui';
  import { mdiCopyright } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount } from 'svelte';

  type Props = {
    rights?: UsageRights;
    title?: string;
    hint?: string;
    /** Whether the user may decide the release status (admins, media managers of the area, owners). */
    canRelease?: boolean;
    /** Several assets: the release status can be left unchanged. */
    bulk?: boolean;
    onClose: (rights?: UsageRightsInput) => void;
  };

  let { rights, title, hint, canRelease = true, bulk = false, onClose }: Props = $props();

  // Saving usage rights "in review" approves them by default, as media managers review them while editing.
  const getInitialStatus = () => {
    if (bulk) {
      return '';
    }
    if (rights?.status && rights.status !== 'suggested') {
      return rights.status;
    }
    return canRelease ? 'confirmed' : 'suggested';
  };

  let status = $state<string>(getInitialStatus());
  let restriction = $state(rights?.restriction ?? '');
  let photographer = $state(rights?.photographer ?? '');
  let copyrightHolder = $state(rights?.copyrightHolder ?? '');
  let licenseType = $state<string>(rights?.licenseType ?? '');
  let licenseSource = $state(rights?.licenseSource ?? '');
  let channels = $state<Channel[]>([]);
  // Several assets: channels without a value keep the value of each asset.
  let channelValues = $state<Record<string, ChannelValue | ''>>({});
  let usageNote = $state(rights?.usageNote ?? '');

  // Active channels, plus deactivated channels that this asset still uses.
  const shownChannels = $derived(
    channels.filter((channel) => channel.active || (!bulk && getChannelValue(rights, channel.id) !== 'no')),
  );
  const hasConditional = $derived(Object.values(channelValues).includes('conditional'));

  onMount(() => {
    getChannels()
      .then((items) => {
        channels = items;
        channelValues = Object.fromEntries(
          items.map((channel) => [channel.id, bulk ? '' : getChannelValue(rights, channel.id)]),
        );
      })
      .catch((error: unknown) => console.error(error));
  });

  const channelOptions = $derived([
    ...(bulk ? [{ label: $ipt('release_status_unchanged'), value: '' }] : []),
    ...CHANNEL_VALUES.map((value) => ({ label: $ipt(`channel_value.${value}`), value })),
  ]);
  let validUntil = $state(rights?.validUntil ?? '');
  let creditLine = $state(rights?.creditLine ?? '');
  let notes = $state(rights?.notes ?? '');

  const statusOptions = $derived([
    ...(bulk ? [{ label: $ipt('release_status_unchanged'), value: '' }] : []),
    ...RELEASE_STATUSES.map((item) => ({ label: $ipt(`release_status.${item}`), value: item })),
  ]);

  const licenseOptions = $derived([
    { label: $ipt('not_specified'), value: '' },
    ...LICENSE_TYPES.map((type) => ({ label: $ipt(`license.${type}`), value: type })),
  ]);

  const onSubmit = () => {
    onClose({
      version: USAGE_RIGHTS_VERSION,
      status: canRelease ? RELEASE_STATUSES.find((item) => item === status) : rights?.status,
      restriction: status === 'restricted' ? restriction : undefined,
      photographer,
      copyrightHolder,
      licenseType: LICENSE_TYPES.find((type) => type === licenseType),
      licenseSource,
      permittedUsage: rights?.permittedUsage,
      conditionalUsage: rights?.conditionalUsage,
      channels: Object.fromEntries(
        Object.entries(channelValues).filter((entry): entry is [string, ChannelValue] => entry[1] !== ''),
      ),
      usageNote,
      validUntil: validUntil || undefined,
      creditLine,
      notes,
    });
  };
</script>

<FormModal
  title={title ?? $ipt('usage_rights_edit')}
  icon={mdiCopyright}
  onClose={() => onClose()}
  {onSubmit}
  size="medium"
>
  <Stack gap={4}>
    {#if hint}
      <Text size="small" color="muted">{hint}</Text>
    {/if}

    {#if canRelease}
      <Field label={$ipt('release_status')}>
        <Select bind:value={status} options={statusOptions} />
      </Field>
      {#if status === 'restricted'}
        <Field label={$ipt('release_restriction')}>
          <Input bind:value={restriction} placeholder={$ipt('release_restriction_placeholder')} />
        </Field>
      {/if}
    {:else}
      <Text size="small" color="muted">{$ipt('release_status_by_managers')}</Text>
    {/if}

    <Field label={$ipt('photographer')}>
      <Input bind:value={photographer} />
    </Field>

    <Field label={$ipt('copyright_holder')}>
      <Input bind:value={copyrightHolder} />
    </Field>

    <Field label={$ipt('credit_line')}>
      <Input bind:value={creditLine} placeholder={$ipt('credit_line_placeholder')} />
    </Field>

    <Field label={$ipt('license_type')}>
      <Select bind:value={licenseType} options={licenseOptions} />
    </Field>

    <Field label={$ipt('license_source')}>
      <Input bind:value={licenseSource} />
    </Field>

    <div>
      <Label label={$ipt('channels')} />
      <div class="mt-2 flex flex-col gap-2">
        {#each shownChannels as channel (channel.id)}
          <div class="flex items-center gap-3">
            <Text class="min-w-0 grow truncate">{channel.label}</Text>
            <div class="w-44 shrink-0">
              <Select
                options={channelOptions}
                bind:value={() => channelValues[channel.id] ?? '', (value) => (channelValues[channel.id] = value as ChannelValue | '')}
              />
            </div>
          </div>
        {/each}
      </div>
    </div>

    {#if hasConditional || usageNote}
      <Field label={$ipt('usage_note')}>
        <Input bind:value={usageNote} placeholder={$ipt('usage_note_placeholder')} />
      </Field>
    {/if}

    <Field label={$ipt('valid_until')}>
      <DatePicker
        value={validUntil ? DateTime.fromISO(validUntil) : undefined}
        onChange={(date) => (validUntil = date?.toISODate() ?? '')}
      />
    </Field>
    {#if validUntil}
      <div>
        <Button size="small" variant="ghost" color="secondary" onclick={() => (validUntil = '')}>
          {$ipt('clear_date')}
        </Button>
      </div>
    {/if}

    <Field label={$ipt('notes')}>
      <Textarea bind:value={notes} rows={3} />
    </Field>
  </Stack>
</FormModal>

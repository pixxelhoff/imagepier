<script lang="ts">
  import UsageRightsModal from '#lib/imagepier/UsageRightsModal.svelte';
  import {
    canEditLibraryAssetOf,
    canManageAreaOf,
    getAreaOfOwner,
    getMediaLibraryAccess,
    type MyAccess,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    RIGHTS_CHECKS,
    applyChannels,
    applyChecks,
    confirmUsageRights,
    getChannelLabel,
    getChannels,
    isBlocked,
    isExpired,
    loadAssetDetails,
    loadUsageRights,
    saveUsageRights,
    type Channel,
    type UsageRights,
  } from '#lib/imagepier/usage-rights.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { copyToClipboard } from '#lib/utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import type { AssetResponseDto } from '@immich/sdk';
  import { Icon, IconButton, Text, modalManager, toastManager } from '@immich/ui';
  import {
    mdiAlertCircleOutline,
    mdiCancel,
    mdiCheckDecagramOutline,
    mdiContentCopy,
    mdiCopyright,
    mdiFolderMultipleImage,
    mdiPencilOutline,
    mdiPlus,
  } from '@mdi/js';
  import { DateTime } from 'luxon';

  interface Props {
    asset: AssetResponseDto;
    isOwner: boolean;
  }

  let { asset, isOwner }: Props = $props();

  let rights = $state<UsageRights | undefined>();
  let uploadedBy = $state<string | undefined>();
  let loadedAssetId = $state<string | undefined>();
  let access = $state<MyAccess>();
  let channels = $state<Channel[]>([]);

  $effect(() => {
    getChannels()
      .then((items) => (channels = items))
      .catch(() => (channels = []));
  });

  $effect(() => {
    const assetId = asset.id;
    rights = undefined;
    uploadedBy = undefined;
    loadedAssetId = undefined;

    loadAssetDetails(assetId)
      .then((result) => {
        if (asset.id === assetId) {
          rights = result.rights;
          uploadedBy = result.uploadedBy;
          loadedAssetId = assetId;
        }
      })
      .catch((error: unknown) => console.error($ipt('usage_rights_load_failed'), error));
  });

  // Media library assets belong to another account; only then the access of the user is needed.
  const loadAccess = async (userId: string) => {
    try {
      access = await getMediaLibraryAccess(userId);
    } catch {
      access = undefined;
    }
  };

  $effect(() => {
    if (!isOwner) {
      void loadAccess(authManager.user.id);
    }
  });

  // Media library assets belong to the account of their area.
  const area = $derived(access ? getAreaOfOwner(access, asset.ownerId) : undefined);
  const isLibraryAsset = $derived(!!area);
  const canEdit = $derived(
    isOwner || (!!access && !!area && canEditLibraryAssetOf(access, authManager.user.id, area.id, uploadedBy)),
  );
  // Usage rights entered by editors stay "to be reviewed" until a media manager confirms them.
  const canConfirm = $derived(isOwner || (!!access && !!area && canManageAreaOf(access, area.id)));
  const areaName = $derived(area?.name);

  const expired = $derived(isExpired(rights));
  const openChecks = $derived(RIGHTS_CHECKS.filter((check) => rights?.checks?.[check] === 'open'));
  const clearedChecks = $derived(RIGHTS_CHECKS.filter((check) => rights?.checks?.[check] === 'cleared'));
  const documentLink = $derived(rights?.rightsDocument ?? '');
  const territoryText = $derived(
    rights?.territory ? [$ipt(`territory.${rights.territory}`), rights.territoryNote].filter(Boolean).join(' · ') : '',
  );
  const isLink = (value: string) => /^https?:\/\//i.test(value);
  const blocked = $derived(isBlocked(rights));

  const formatDate = (isoDate: string) =>
    DateTime.fromISO(isoDate).toLocaleString(DateTime.DATE_MED, { locale: $locale });

  const handleEdit = async () => {
    const assetId = asset.id;
    const result = await modalManager.show(UsageRightsModal, { rights, canRelease: canConfirm });
    if (!result) {
      return;
    }

    const status = result.status ?? rights?.status ?? 'suggested';
    try {
      const saved = await saveUsageRights(
        assetId,
        applyChecks(applyChannels({ ...result, status }, result.channels), result.checkValues),
      );
      if (asset.id === assetId) {
        rights = saved;
      }
      toastManager.primary(
        saved.status === status ? $ipt('usage_rights_saved') : $ipt('usage_rights_saved_for_review'),
      );
    } catch (error) {
      handleError(error, $ipt('usage_rights_save_failed'));
    }
  };

  const handleConfirm = async () => {
    const assetId = asset.id;
    try {
      await confirmUsageRights([assetId]);
      const confirmed = await loadUsageRights(assetId);
      if (asset.id === assetId) {
        rights = confirmed;
      }
      toastManager.primary($ipt('usage_rights_confirmed', { count: 1 }));
    } catch (error) {
      handleError(error, $ipt('usage_rights_confirm_failed'));
    }
  };
</script>

{#if loadedAssetId === asset.id && (rights || canEdit || isLibraryAsset)}
  <section class="px-4 pt-6" data-testid="imagepier-usage-rights">
    <div class="flex h-10 w-full items-center justify-between text-sm">
      <Text size="small" color="muted">{$ipt('usage_rights')}</Text>
      {#if canEdit}
        <IconButton
          icon={rights ? mdiPencilOutline : mdiPlus}
          aria-label={rights ? $ipt('usage_rights_edit') : $ipt('usage_rights_add')}
          title={rights ? $ipt('usage_rights_edit') : $ipt('usage_rights_add')}
          size="small"
          shape="round"
          color="secondary"
          variant="ghost"
          onclick={handleEdit}
        />
      {/if}
    </div>

    {#if isLibraryAsset && areaName}
      <div class="flex items-center gap-4 py-2 text-sm">
        <Icon icon={mdiFolderMultipleImage} size="24" />
        <p><span class="opacity-60">{$ipt('area')}:</span> {areaName}</p>
      </div>
    {/if}

    {#if rights}
      <div class="flex gap-4 py-2">
        <div><Icon icon={mdiCopyright} size="24" /></div>

        <div class="flex w-full flex-col gap-2 text-sm">
          {#if rights.status === 'confirmed'}
            <p class="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <Icon icon={mdiCheckDecagramOutline} size="14" />
              {$ipt('release_status.confirmed')}
            </p>
          {:else if rights.status === 'restricted'}
            <div class="text-xs text-amber-600 dark:text-amber-400">
              <p class="font-medium">{$ipt('release_status.restricted')}</p>
              {#if rights.restriction}
                <p class="wrap-break-word">{rights.restriction}</p>
              {/if}
            </div>
          {:else if blocked}
            <div class="text-xs text-red-600 dark:text-red-400">
              <p class="flex items-center gap-1 font-medium">
                <Icon icon={mdiCancel} size="14" />
                {$ipt('release_status.blocked')}
              </p>
              <p>{$ipt('release_status_blocked_hint')}</p>
            </div>
          {:else}
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-amber-600 dark:text-amber-400">
                {rights.suggestedFrom?.length ? $ipt('usage_rights_suggested') : $ipt('usage_rights_unconfirmed')}
              </p>
              {#if canConfirm}
                <IconButton
                  icon={mdiCheckDecagramOutline}
                  aria-label={$ipt('usage_rights_confirm')}
                  title={$ipt('usage_rights_confirm')}
                  class="-my-1 shrink-0"
                  size="small"
                  shape="round"
                  color="primary"
                  variant="ghost"
                  onclick={handleConfirm}
                />
              {/if}
            </div>
          {/if}

          {#if rights.creditLine}
            <div class="flex items-start justify-between gap-2">
              <p class="text-base font-medium wrap-break-word">{rights.creditLine}</p>
              <IconButton
                icon={mdiContentCopy}
                aria-label={$ipt('credit_line_copy')}
                title={$ipt('credit_line_copy')}
                class="-my-1 shrink-0"
                size="small"
                shape="round"
                color="secondary"
                variant="ghost"
                onclick={() => copyToClipboard(rights?.creditLine)}
              />
            </div>
          {/if}

          {#if rights.title}
            <p class="font-medium wrap-break-word">{rights.title}</p>
          {/if}

          {#if openChecks.length > 0}
            <div class="text-xs text-amber-600 dark:text-amber-400">
              <p class="font-medium">{$ipt('checks_open')}</p>
              <p>{openChecks.map((check) => $ipt(`check.${check}`)).join(', ')}</p>
            </div>
          {/if}

          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {#if rights.altText}
              <dt class="opacity-60">{$ipt('alt_text')}</dt>
              <dd class="wrap-break-word">{rights.altText}</dd>
            {/if}
            {#if rights.photographer}
              <dt class="opacity-60">{$ipt('photographer')}</dt>
              <dd class="wrap-break-word">{rights.photographer}</dd>
            {/if}
            {#if rights.copyrightHolder}
              <dt class="opacity-60">{$ipt('copyright_holder')}</dt>
              <dd class="wrap-break-word">{rights.copyrightHolder}</dd>
            {/if}
            {#if rights.licenseType}
              <dt class="opacity-60">{$ipt('license_type')}</dt>
              <dd>{$ipt(`license.${rights.licenseType}`)}</dd>
            {/if}
            {#if rights.licenseSource}
              <dt class="opacity-60">{$ipt('license_source')}</dt>
              <dd class="wrap-break-word">{rights.licenseSource}</dd>
            {/if}
            {#if rights.permittedUsage?.length}
              <dt class="opacity-60">{$ipt('permitted_usage')}</dt>
              <dd>{rights.permittedUsage.map((id) => getChannelLabel(channels, id)).join(', ')}</dd>
            {/if}
            {#if rights.conditionalUsage?.length}
              <dt class="opacity-60">{$ipt('conditional_usage')}</dt>
              <dd>{rights.conditionalUsage.map((id) => getChannelLabel(channels, id)).join(', ')}</dd>
            {/if}
            {#if rights.usageNote}
              <dt class="opacity-60">{$ipt('usage_note')}</dt>
              <dd class="wrap-break-word">{rights.usageNote}</dd>
            {/if}
            {#if rights.territory}
              <dt class="opacity-60">{$ipt('territory')}</dt>
              <dd>{territoryText}</dd>
            {/if}
            {#if rights.editing}
              <dt class="opacity-60">{$ipt('editing')}</dt>
              <dd>{$ipt(`editing.${rights.editing}`)}</dd>
            {/if}
            {#if rights.transfer}
              <dt class="opacity-60">{$ipt('transfer')}</dt>
              <dd>{$ipt(`transfer.${rights.transfer}`)}</dd>
            {/if}
            {#if rights.exclusive !== undefined}
              <dt class="opacity-60">{$ipt('exclusive')}</dt>
              <dd>{rights.exclusive ? $ipt('yes') : $ipt('no')}</dd>
            {/if}
            {#if clearedChecks.length > 0}
              <dt class="opacity-60">{$ipt('checks_cleared')}</dt>
              <dd>{clearedChecks.map((check) => $ipt(`check.${check}`)).join(', ')}</dd>
            {/if}
            {#if rights.rightsDocument}
              <dt class="opacity-60">{$ipt('rights_document')}</dt>
              <dd class="wrap-break-word">
                {#if isLink(rights.rightsDocument)}
                  <a class="underline" href={documentLink} target="_blank" rel="noreferrer">{documentLink}</a>
                {:else}
                  {rights.rightsDocument}
                {/if}
              </dd>
            {/if}
            <dt class="opacity-60">{$ipt('valid_until')}</dt>
            <dd class:text-red-600={expired} class:dark:text-red-400={expired}>
              {rights.validUntil ? formatDate(rights.validUntil) : $ipt('valid_until_unlimited')}
            </dd>
            {#if rights.notes}
              <dt class="opacity-60">{$ipt('notes')}</dt>
              <dd class="wrap-break-word whitespace-pre-line">{rights.notes}</dd>
            {/if}
          </dl>

          {#if expired}
            <p class="flex items-center gap-1 text-red-600 dark:text-red-400">
              <Icon icon={mdiAlertCircleOutline} size="16" />
              {$ipt('usage_rights_expired')}
            </p>
          {/if}
        </div>
      </div>
    {:else}
      <Text size="small" color="muted">{$ipt('usage_rights_none')}</Text>
    {/if}
  </section>
{/if}

<script lang="ts">
  import {
    getGalleryCredit,
    getGalleryDownloadUrl,
    getGalleryImageUrl,
    getPublicGallery,
    type GalleryAsset,
    type PublicGallery,
  } from '#lib/imagepier/gallery.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { Checkbox, Heading, Icon, IconButton, Label, Text } from '@immich/ui';
  import { mdiChevronLeft, mdiChevronRight, mdiClose, mdiDownload } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount } from 'svelte';

  interface Props {
    galleryKey: string;
  }

  let { galleryKey }: Props = $props();

  let gallery = $state<PublicGallery>();
  let failed = $state(false);
  let selectedIndex = $state<number>();
  let accepted = $state(false);

  onMount(() => {
    void getPublicGallery(galleryKey)
      .then((value) => (gallery = value))
      .catch(() => (failed = true));
  });

  const accent = $derived(gallery?.branding.color ?? '#4250af');
  const selected = $derived(
    gallery && selectedIndex !== undefined ? (gallery.assets[selectedIndex] as GalleryAsset | undefined) : undefined,
  );

  const open = (index: number) => {
    selectedIndex = index;
    accepted = false;
  };

  const close = () => {
    selectedIndex = undefined;
  };

  const move = (step: number) => {
    if (!gallery || selectedIndex === undefined || gallery.assets.length === 0) {
      return;
    }
    open((selectedIndex + step + gallery.assets.length) % gallery.assets.length);
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (selectedIndex === undefined) {
      return;
    }
    switch (event.key) {
      case 'Escape': {
        close();
        break;
      }
      case 'ArrowLeft': {
        move(-1);
        break;
      }
      case 'ArrowRight': {
        move(1);
        break;
      }
    }
  };

  const formatDate = (value: string) => DateTime.fromISO(value).toLocaleString(DateTime.DATE_MED);
</script>

<svelte:window onkeydown={onKeydown} />

<div class="min-h-dvh bg-white text-gray-900" data-testid="imagepier-gallery">
  <header class="flex items-center gap-4 border-b-4 px-6 py-4" style:border-color={accent}>
    {#if gallery?.branding.logo}
      <img src={gallery.branding.logo} alt="" class="h-12 w-auto" />
    {/if}
    <div>
      {#if gallery?.branding.title}
        <Text size="small" color="muted">{gallery.branding.title}</Text>
      {/if}
      <Heading size="large" tag="h1">{gallery?.title ?? ''}</Heading>
    </div>
  </header>

  <main class="p-6">
    {#if failed}
      <Text>{$ipt('gallery_not_found')}</Text>
    {:else if gallery && gallery.assets.length === 0}
      <Text>{$ipt('gallery_empty')}</Text>
    {:else if gallery}
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {#each gallery.assets as asset, index (asset.id)}
          <figure>
            <button type="button" class="block w-full" onclick={() => open(index)}>
              <img
                src={getGalleryImageUrl(galleryKey, asset.id, 'thumbnail')}
                alt={asset.fileName}
                class="aspect-square w-full rounded-lg object-cover"
                loading="lazy"
              />
            </button>
            <figcaption class="mt-1 text-xs text-gray-600">{getGalleryCredit(asset)}</figcaption>
          </figure>
        {/each}
      </div>
    {/if}
  </main>

  {#if gallery && (gallery.branding.footer || gallery.branding.imprintUrl || gallery.branding.privacyUrl)}
    <footer class="border-t px-6 py-4 text-sm text-gray-600">
      {#if gallery.branding.footer}
        <p class="whitespace-pre-line">{gallery.branding.footer}</p>
      {/if}
      <p class="mt-2 flex gap-4">
        {#if gallery.branding.imprintUrl}
          <a href={gallery.branding.imprintUrl} target="_blank" rel="noopener noreferrer" class="underline">
            {$ipt('gallery_imprint')}
          </a>
        {/if}
        {#if gallery.branding.privacyUrl}
          <a href={gallery.branding.privacyUrl} target="_blank" rel="noopener noreferrer" class="underline">
            {$ipt('gallery_privacy')}
          </a>
        {/if}
      </p>
    </footer>
  {/if}
</div>

{#if gallery && selected}
  <div class="fixed inset-0 z-50 flex flex-col bg-black/90 text-white lg:flex-row" role="dialog" aria-modal="true">
    <div class="relative flex min-h-0 grow items-center justify-center p-4">
      <img
        src={getGalleryImageUrl(galleryKey, selected.id, 'preview')}
        alt={selected.fileName}
        class="max-h-full max-w-full object-contain"
      />
      <div class="absolute top-4 left-4">
        <IconButton
          icon={mdiClose}
          aria-label={$ipt('gallery_close')}
          color="secondary"
          shape="round"
          onclick={close}
        />
      </div>
      {#if gallery.assets.length > 1}
        <div class="absolute top-1/2 left-4">
          <IconButton
            icon={mdiChevronLeft}
            aria-label={$ipt('gallery_previous')}
            color="secondary"
            shape="round"
            onclick={() => move(-1)}
          />
        </div>
        <div class="absolute top-1/2 right-4">
          <IconButton
            icon={mdiChevronRight}
            aria-label={$ipt('gallery_next')}
            color="secondary"
            shape="round"
            onclick={() => move(1)}
          />
        </div>
      {/if}
    </div>

    <aside class="w-full shrink-0 overflow-y-auto bg-white p-6 text-gray-900 lg:w-96">
      <dl class="flex flex-col gap-3 text-sm">
        <div>
          <dt class="text-gray-500">{$ipt('gallery_credit')}</dt>
          <dd class="font-medium">{getGalleryCredit(selected)}</dd>
        </div>
        {#if selected.photographer}
          <div>
            <dt class="text-gray-500">{$ipt('photographer')}</dt>
            <dd>{selected.photographer}</dd>
          </div>
        {/if}
        {#if selected.copyrightHolder}
          <div>
            <dt class="text-gray-500">{$ipt('copyright_holder')}</dt>
            <dd>{selected.copyrightHolder}</dd>
          </div>
        {/if}
        {#if selected.license}
          <div>
            <dt class="text-gray-500">{$ipt('license_type')}</dt>
            <dd>{selected.license}{selected.licenseSource ? ` · ${selected.licenseSource}` : ''}</dd>
          </div>
        {/if}
        <div>
          <dt class="text-gray-500">{$ipt('permitted_usage')}</dt>
          <dd>{selected.usages.join(', ')}</dd>
        </div>
        <div>
          <dt class="text-gray-500">{$ipt('valid_until')}</dt>
          <dd>{selected.validUntil ? formatDate(selected.validUntil) : $ipt('valid_until_unlimited')}</dd>
        </div>
      </dl>

      {#if gallery.allowDownload}
        <div class="mt-6 flex flex-col gap-3 border-t pt-4">
          <Text size="small">{$ipt('gallery_credit_hint')}</Text>
          <div class="flex items-start gap-2">
            <Checkbox
              id="imagepier-gallery-accept"
              size="tiny"
              checked={accepted}
              onCheckedChange={(value) => (accepted = value)}
            />
            <Label for="imagepier-gallery-accept" label={$ipt('gallery_terms_accept')} />
          </div>
          {#if accepted}
            <a
              href={getGalleryDownloadUrl(galleryKey, selected.id)}
              download={selected.fileName}
              class="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium text-white"
              style:background-color={accent}
            >
              <Icon icon={mdiDownload} size="20" />
              {$ipt('gallery_download')}
            </a>
          {/if}
        </div>
      {/if}
    </aside>
  </div>
{/if}

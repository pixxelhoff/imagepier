<script lang="ts">
  import {
    getGalleryArchiveUrl,
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
  import { SvelteSet } from 'svelte/reactivity';

  interface Props {
    galleryKey: string;
  }

  let { galleryKey }: Props = $props();

  let gallery = $state<PublicGallery>();
  let failed = $state(false);
  let selectedIndex = $state<number>();
  let accepted = $state(false);
  let bulkAccepted = $state(false);
  let selecting = $state(false);
  const selection = new SvelteSet<string>();

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      selection.add(id);
    } else {
      selection.delete(id);
    }
  };

  const stopSelecting = () => {
    selecting = false;
    bulkAccepted = false;
    selection.clear();
  };

  const selectAll = () => {
    for (const asset of gallery?.assets ?? []) {
      selection.add(asset.id);
    }
  };

  const downloadClass = 'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium text-white';

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

<svelte:head>
  <title>{gallery?.title || $ipt('website_gallery')} - {gallery?.branding.title || 'ImagePier'}</title>
</svelte:head>

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
      {#if gallery.allowDownload && !selecting}
        <div class="mb-6">
          <button
            type="button"
            class={downloadClass}
            style:background-color={accent}
            onclick={() => (selecting = true)}
          >
            <Icon icon={mdiDownload} size="20" />
            {$ipt('gallery_download')}
          </button>
        </div>
      {:else if gallery.allowDownload}
        <div class="mb-6 flex flex-col gap-3 rounded-lg border p-4 text-sm">
          <div class="flex flex-wrap items-center gap-4">
            <span>{$ipt('gallery_selected', { count: selection.size, total: gallery.assets.length })}</span>
            <button type="button" class="underline" onclick={selectAll}>{$ipt('gallery_select_all')}</button>
            {#if selection.size > 0}
              <button type="button" class="underline" onclick={() => selection.clear()}>
                {$ipt('gallery_select_none')}
              </button>
            {/if}
          </div>
          <Text size="small" color="muted">{$ipt('gallery_download_archive_hint')}</Text>
          <div class="flex items-start gap-2">
            <Checkbox
              id="imagepier-gallery-accept-all"
              size="tiny"
              checked={bulkAccepted}
              onCheckedChange={(value) => (bulkAccepted = value)}
            />
            <Label for="imagepier-gallery-accept-all" label={$ipt('gallery_terms_accept')} />
          </div>
          <div class="flex flex-wrap gap-3">
            <form method="post" action={getGalleryArchiveUrl(galleryKey)}>
              <input type="hidden" name="ids" value={[...selection].join(',')} />
              <button
                type="submit"
                disabled={!bulkAccepted || selection.size === 0}
                class={[downloadClass, (!bulkAccepted || selection.size === 0) && 'opacity-50']}
                style:background-color={accent}
              >
                <Icon icon={mdiDownload} size="20" />
                {$ipt('gallery_download_selection', { count: selection.size })}
              </button>
            </form>
            <a
              href={getGalleryArchiveUrl(galleryKey)}
              aria-disabled={!bulkAccepted}
              tabindex={bulkAccepted ? undefined : -1}
              class={[downloadClass, !bulkAccepted && 'pointer-events-none opacity-50']}
              style:background-color={accent}
            >
              <Icon icon={mdiDownload} size="20" />
              {$ipt('gallery_download_all', { count: gallery.assets.length })}
            </a>
            <button type="button" class="px-2 underline" onclick={stopSelecting}>{$ipt('gallery_cancel')}</button>
          </div>
        </div>
      {/if}
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {#each gallery.assets as asset, index (asset.id)}
          <figure class="relative">
            <button type="button" class="block w-full" onclick={() => open(index)}>
              <img
                src={getGalleryImageUrl(galleryKey, asset.id, 'thumbnail')}
                alt={asset.altText ?? asset.title ?? asset.fileName}
                class="aspect-square w-full rounded-lg object-cover"
                loading="lazy"
              />
            </button>
            {#if gallery.allowDownload && selecting}
              <input
                type="checkbox"
                class="absolute top-2 left-2 size-5 cursor-pointer"
                style:accent-color={accent}
                aria-label={$ipt('gallery_select_image', { name: asset.fileName })}
                checked={selection.has(asset.id)}
                onchange={(event) => toggle(asset.id, event.currentTarget.checked)}
              />
            {/if}
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
  <div
    class="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black/90 text-white lg:flex-row lg:overflow-hidden"
    role="dialog"
    aria-modal="true"
  >
    <div class="relative flex h-[65dvh] shrink-0 items-center justify-center p-4 lg:h-auto lg:shrink lg:grow">
      <img
        src={getGalleryImageUrl(galleryKey, selected.id, 'preview')}
        alt={selected.altText ?? selected.title ?? selected.fileName}
        class="max-h-full max-w-full object-contain"
      />
      <div class="fixed top-4 left-4 z-10">
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

    <aside class="w-full shrink-0 bg-white p-6 text-gray-900 lg:w-96 lg:overflow-y-auto">
      <dl class="flex flex-col gap-3 text-sm">
        {#if selected.title}
          <div>
            <dt class="text-gray-500">{$ipt('image_title')}</dt>
            <dd class="font-medium">{selected.title}</dd>
          </div>
        {/if}
        {#if getGalleryCredit(selected)}
          <div>
            <dt class="text-gray-500">{$ipt('gallery_credit')}</dt>
            <dd class="font-medium">{getGalleryCredit(selected)}</dd>
          </div>
        {/if}
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
          <a
            href={getGalleryDownloadUrl(galleryKey, selected.id)}
            download={selected.fileName}
            aria-disabled={!accepted}
            tabindex={accepted ? undefined : -1}
            class={[downloadClass, !accepted && 'pointer-events-none opacity-50']}
            style:background-color={accent}
          >
            <Icon icon={mdiDownload} size="20" />
            {$ipt('gallery_download')}
          </a>
        </div>
      {/if}
    </aside>
  </div>
{/if}

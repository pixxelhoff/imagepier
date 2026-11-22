<script lang="ts">
  import {
    MAX_LOGO_LENGTH,
    getGalleryBranding,
    updateGalleryBranding,
    type GalleryBranding,
  } from '#lib/imagepier/gallery.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { Button, Field, HelperText, Input, Stack, Text, Textarea, toastManager } from '@immich/ui';
  import { onMount } from 'svelte';

  let title = $state('');
  let color = $state('#4250af');
  let logo = $state<string>();
  let footer = $state('');
  let imprintUrl = $state('');
  let privacyUrl = $state('');
  let loaded = $state(false);
  let saving = $state(false);
  let logoError = $state(false);

  onMount(() => {
    void getGalleryBranding()
      .then((value) => {
        apply(value);
        loaded = true;
      })
      .catch(() => (loaded = false));
  });

  const apply = (value: GalleryBranding) => {
    title = value.title ?? '';
    color = value.color ?? '#4250af';
    logo = value.logo;
    footer = value.footer ?? '';
    imprintUrl = value.imprintUrl ?? '';
    privacyUrl = value.privacyUrl ?? '';
  };

  const onLogoChange = (event: Event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      logoError = result.length > MAX_LOGO_LENGTH;
      if (!logoError) {
        logo = result;
      }
    });
    reader.readAsDataURL(file);
  };

  const save = async () => {
    saving = true;
    try {
      apply(await updateGalleryBranding({ title, color, logo, footer, imprintUrl, privacyUrl }));
      toastManager.primary($ipt('gallery_branding_saved'));
    } catch (error) {
      handleError(error, $ipt('gallery_failed'));
    } finally {
      saving = false;
    }
  };
</script>

{#if loaded}
  <Stack gap={4}>
    <Text color="muted">{$ipt('gallery_branding_description')}</Text>
    <Field label={$ipt('gallery_branding_title')}>
      <Input bind:value={title} />
    </Field>
    <div>
      <Text size="small">{$ipt('gallery_branding_color')}</Text>
      <input
        type="color"
        class="mt-2 h-10 w-20 cursor-pointer rounded-sm"
        aria-label={$ipt('gallery_branding_color')}
        bind:value={color}
      />
    </div>
    <div>
      <Text size="small">{$ipt('gallery_branding_logo')}</Text>
      {#if logo}
        <img src={logo} alt="" class="my-2 h-12 w-auto" />
        <Button size="small" variant="ghost" color="secondary" onclick={() => (logo = undefined)}>
          {$ipt('gallery_branding_logo_remove')}
        </Button>
      {/if}
      <input
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        class="mt-2 block text-sm"
        aria-label={$ipt('gallery_branding_logo')}
        onchange={onLogoChange}
      />
      {#if logoError}
        <HelperText color="danger">{$ipt('gallery_logo_too_large')}</HelperText>
      {/if}
    </div>
    <Field label={$ipt('gallery_branding_footer')}>
      <Textarea bind:value={footer} rows={3} />
    </Field>
    <Field label={$ipt('gallery_imprint_url')}>
      <Input bind:value={imprintUrl} placeholder="https://" />
    </Field>
    <Field label={$ipt('gallery_privacy_url')}>
      <Input bind:value={privacyUrl} placeholder="https://" />
    </Field>
    <div>
      <Button onclick={save} loading={saving}>{$ipt('save')}</Button>
    </div>
  </Stack>
{/if}

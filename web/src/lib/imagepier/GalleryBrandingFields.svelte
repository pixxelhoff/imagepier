<script lang="ts">
  import { MAX_LOGO_LENGTH, type GalleryBranding } from '#lib/imagepier/gallery.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { Button, Field, HelperText, Input, Stack, Switch, Text, Textarea } from '@immich/ui';

  interface Props {
    branding: GalleryBranding;
    /** Default appearance; if set, empty fields use these values. */
    defaults?: GalleryBranding;
  }

  let { branding = $bindable(), defaults }: Props = $props();

  const DEFAULT_COLOR = '#4250af';

  let logoError = $state(false);

  const hasOwnColor = () => branding.color !== undefined;
  const setOwnColor = (value: boolean) => {
    branding.color = value ? (defaults?.color ?? DEFAULT_COLOR) : undefined;
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
        branding.logo = result;
      }
    });
    reader.readAsDataURL(file);
  };
</script>

<Stack gap={4}>
  {#if defaults}
    <Text size="small" color="muted">{$ipt('gallery_own_branding_hint')}</Text>
  {/if}
  <Field label={$ipt('gallery_branding_title')}>
    <Input
      bind:value={() => branding.title ?? '', (value) => (branding.title = value || undefined)}
      placeholder={defaults?.title}
    />
  </Field>
  <div>
    {#if defaults}
      <Field label={$ipt('gallery_branding_own_color')}>
        <Switch bind:checked={hasOwnColor, setOwnColor} />
      </Field>
    {:else}
      <Text size="small">{$ipt('gallery_branding_color')}</Text>
    {/if}
    {#if !defaults || branding.color !== undefined}
      <input
        type="color"
        class="mt-2 h-10 w-20 cursor-pointer rounded-sm"
        aria-label={$ipt('gallery_branding_color')}
        bind:value={() => branding.color ?? DEFAULT_COLOR, (value) => (branding.color = value)}
      />
    {/if}
  </div>
  <div>
    <Text size="small">{$ipt('gallery_branding_logo')}</Text>
    {#if branding.logo}
      <img src={branding.logo} alt="" class="my-2 h-12 w-auto" />
      <Button size="small" variant="ghost" color="secondary" onclick={() => (branding.logo = undefined)}>
        {$ipt('gallery_branding_logo_remove')}
      </Button>
    {:else if defaults?.logo}
      <img src={defaults.logo} alt="" class="my-2 h-12 w-auto opacity-60" />
      <Text size="small" color="muted">{$ipt('gallery_branding_default_logo')}</Text>
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
    <Textarea
      bind:value={() => branding.footer ?? '', (value) => (branding.footer = value || undefined)}
      placeholder={defaults?.footer}
      rows={3}
    />
  </Field>
  <Field label={$ipt('gallery_imprint_url')}>
    <Input
      bind:value={() => branding.imprintUrl ?? '', (value) => (branding.imprintUrl = value || undefined)}
      placeholder={defaults?.imprintUrl ?? 'https://'}
    />
  </Field>
  <Field label={$ipt('gallery_privacy_url')}>
    <Input
      bind:value={() => branding.privacyUrl ?? '', (value) => (branding.privacyUrl = value || undefined)}
      placeholder={defaults?.privacyUrl ?? 'https://'}
    />
  </Field>
</Stack>

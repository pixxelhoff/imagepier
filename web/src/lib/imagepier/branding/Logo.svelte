<script lang="ts">
  import { cleanClass } from '#lib';
  import { BRANDING_VERSION } from '#lib/imagepier/branding/version.ts';
  import { Theme, themeManager, type Size } from '@immich/ui';

  // Drop-in replacement for the Logo component of @immich/ui (same props).
  // Variants: icon/logo = picture mark, inline = word mark, stacked = picture mark above word mark.
  // The image files live in static/imagepier and can be replaced at runtime by mounting a folder.
  // The version parameter makes browsers and proxies load new logo files after an update.
  type Props = {
    size?: Size | 'landing';
    variant?: 'stacked' | 'inline' | 'logo' | 'icon' | 'stacked-futo';
    class?: string;
  };

  const { variant = 'logo', size = 'medium', class: className }: Props = $props();

  const heights: Record<NonNullable<Props['size']>, string> = {
    tiny: 'h-8',
    small: 'h-10',
    medium: 'h-12',
    large: 'h-16',
    giant: 'h-24',
    landing: 'h-64',
  };

  const theme = $derived(themeManager.value === Theme.Light ? 'light' : 'dark');
  const file = $derived.by(() => {
    switch (variant) {
      case 'inline': {
        return `logo-inline-${theme}.svg`;
      }

      case 'stacked':
      case 'stacked-futo': {
        return `logo-stacked-${theme}.svg`;
      }

      default: {
        return 'logo-icon.svg';
      }
    }
  });
  const isIcon = $derived(variant === 'icon' || variant === 'logo');
</script>

<img
  src="/imagepier/{file}?v={BRANDING_VERSION}"
  class={cleanClass(heights[size], isIcon && 'aspect-square', className)}
  alt="ImagePier"
/>

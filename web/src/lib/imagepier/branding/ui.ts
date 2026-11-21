// ImagePier build: every import of '@immich/ui' in the web app resolves to this module
// (see vite-plugin.ts). It re-exports the library and swaps the Immich logo.
export * from '@immich/ui';
export { default as Logo } from '#lib/imagepier/branding/Logo.svelte';
export const immichLogo = '/imagepier/logo-icon.svg';

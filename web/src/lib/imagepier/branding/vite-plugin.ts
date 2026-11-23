import type { Logger, Plugin, ResolvedConfig } from 'vite';

// ImagePier branding, applied at build time so that Immich source files stay untouched.
// Not active in unit tests, which keep running against the original Immich code.

export const BRAND_NAME = 'ImagePier';

const BRANDING_DIR = '/src/lib/imagepier/branding/';

// Immich components that ImagePier hides (rendered as empty components).
const HIDDEN_COMPONENTS = ['/src/lib/components/shared-components/side-bar/PurchaseInfo.svelte'];

// Literal text replacements in Immich source files. A replacement that no longer matches
// after an Immich update is reported as a build warning.
const TEXT_REPLACEMENTS: { file: string; search: string; replace: string }[] = [
  { file: '/src/routes/+layout.svelte', search: '} - Immich</title>', replace: `} - ${BRAND_NAME}</title>` },
  { file: '/src/routes/+layout.ts', search: "title: 'Immich'", replace: `title: '${BRAND_NAME}'` },
  {
    file: '/src/lib/components/pages/SharedLinkPage.svelte',
    search: "' - Immich'",
    replace: `' - ${BRAND_NAME}'`,
  },
  {
    file: '/src/lib/components/layouts/AuthPageLayout.svelte',
    search: '<Logo variant="icon" size="giant" />',
    replace: '<Logo variant="stacked" class="h-40" />',
  },
  {
    file: '/src/lib/components/layouts/AuthPageLayout.svelte',
    search: 'alt="Immich logo"',
    replace: `alt="${BRAND_NAME}"`,
  },
  {
    file: '/src/lib/utils/handle-error.ts',
    search: '(Immich Server Error)',
    replace: `(${BRAND_NAME} server error)`,
  },
  {
    file: '/src/lib/components/pages/SharedLinkErrorPage.svelte',
    search: '} - Immich</title>',
    replace: `} - ${BRAND_NAME}</title>`,
  },
  {
    file: '/src/lib/modals/ServerAboutModal.svelte',
    search: "  import ServerAboutItem from '#lib/components/ServerAboutItem.svelte';",
    replace: [
      "  import AboutImagePier from '#lib/imagepier/branding/AboutImagePier.svelte';",
      "  import ServerAboutItem from '#lib/components/ServerAboutItem.svelte';",
    ].join('\n'),
  },
  {
    file: '/src/lib/modals/ServerAboutModal.svelte',
    search: '<ServerAboutItem id="immich" title="Immich"',
    replace: '<AboutImagePier {info} />\n      <ServerAboutItem id="immich" title="Immich"',
  },
];

// Translation keys that refer to the Immich project itself and keep its name.
const KEEP_IMMICH_NAME = /buy|purchase|support|official|obtainium|my_immich|version_announcement/;

// Single translations that ImagePier words differently, by language file.
const TRANSLATION_OVERRIDES: Record<string, Record<string, string>> = {
  de: {
    administration: 'Administration',
    support_third_party_description:
      'ImagePier basiert auf Immich. Wende dich bei Fragen oder Problemen bitte zuerst über die folgenden Links an ImagePier.',
  },
  en: {
    support_third_party_description:
      'ImagePier is based on Immich. For questions or issues, please contact ImagePier first using the links below.',
  },
};

const normalizeId = (id: string) => id.split('?', 1)[0].replaceAll('\\', '/');

// Loading screen in the built index.html (from Immich's app.html): Immich logo -> spinning ring in ImagePier colors.
const SPLASH_SVG = /(<div id="stencil">)\s*<svg[\s\S]*?<\/svg>/;
const SPLASH_ANIMATION = /loadspin\s+8s\s+linear\s+infinite/;
const SPLASH_SPINNER = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
  '<defs><linearGradient id="imagepier-spinner" x1="0" y1="0" x2="1" y2="1">',
  '<stop offset="0" stop-color="#ffc857"/><stop offset=".35" stop-color="#ff7eb3"/>',
  '<stop offset=".65" stop-color="#a66cff"/><stop offset="1" stop-color="#1fa2ff"/>',
  '</linearGradient></defs>',
  '<circle cx="32" cy="32" r="26" fill="none" stroke="#a66cff" stroke-opacity=".18" stroke-width="6"/>',
  '<circle cx="32" cy="32" r="26" fill="none" stroke="url(#imagepier-spinner)" stroke-width="6"',
  ' stroke-linecap="round" stroke-dasharray="112 52"/>',
  '</svg>',
].join('');

// Icons get a version parameter so browsers and proxies load them again after an update.
const ICON_LINKS = /href="\/(favicon\.ico|icon\.svg|apple-icon-180\.png)"/g;

export const rebrandIndexHtml = (html: string, version = '') =>
  html
    .replace(SPLASH_SVG, (_, div: string) => `${div}${SPLASH_SPINNER}`)
    .replaceAll(ICON_LINKS, (_, file: string) => `href="/${file}?v=${version}"`)
    .replace(SPLASH_ANIMATION, () => 'loadspin 1s linear infinite')
    .replace('To use Immich,', () => `To use ${BRAND_NAME},`);

type FileAccess = {
  readFileSync: (path: string, encoding: 'utf8') => string;
  writeFileSync: (path: string, data: string) => void;
};

export const rebrandText = (text: string) => text.replaceAll(/\bImmich\b/g, () => BRAND_NAME);

export const rebrandTranslations = (messages: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(messages).map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, KEEP_IMMICH_NAME.test(key) ? value : rebrandText(value)];
      }

      if (value && typeof value === 'object') {
        return [key, rebrandTranslations(value as Record<string, unknown>)];
      }

      return [key, value];
    }),
  );

export const imagePierBranding = (): Plugin => {
  const buildVersion = Date.now().toString(36);
  let brandingDir = '';
  let logger: Logger | undefined;
  const applied = new Set<string>();

  return {
    name: 'imagepier:branding',
    enforce: 'pre',
    apply: (_, { mode }) => mode !== 'test',

    configResolved(config: ResolvedConfig) {
      brandingDir = `${normalizeId(config.root)}${BRANDING_DIR}`;
      logger = config.logger;
    },

    buildStart() {
      applied.clear();
    },

    resolveId(source, importer) {
      if (source !== '@immich/ui' || !importer || normalizeId(importer).startsWith(brandingDir)) {
        return;
      }

      return `${brandingDir}ui.ts`;
    },

    transform(code, id) {
      const file = normalizeId(id);

      const translation = /\/i18n\/([\w-]+)\.json$/.exec(file);
      if (translation) {
        const messages = rebrandTranslations(JSON.parse(code) as Record<string, unknown>);
        return { code: JSON.stringify({ ...messages, ...TRANSLATION_OVERRIDES[translation[1]] }), map: null };
      }

      if (file === `${brandingDir}version.ts`) {
        return { code: code.replace("'dev'", () => JSON.stringify(buildVersion)), map: null };
      }

      const hidden = HIDDEN_COMPONENTS.find((component) => file.endsWith(component));
      if (hidden) {
        applied.add(hidden);
        return { code: '', map: null };
      }

      let result = code;
      for (const replacement of TEXT_REPLACEMENTS) {
        if (!file.endsWith(replacement.file) || !result.includes(replacement.search)) {
          continue;
        }

        result = result.replaceAll(replacement.search, () => replacement.replace);
        applied.add(`${replacement.file}: ${replacement.search}`);
      }

      return result === code ? undefined : { code: result, map: null };
    },

    buildEnd(error) {
      if (error) {
        return;
      }

      const expected = [...HIDDEN_COMPONENTS, ...TEXT_REPLACEMENTS.map(({ file, search }) => `${file}: ${search}`)];
      const missing = expected.filter((item) => !applied.has(item));
      if (missing.length > 0) {
        logger?.warn(`ImagePier branding not applied (check after an Immich update): ${missing.join('; ')}`);
      }
    },
  };
};

// Rewrites the built index.html (loading screen, icon versions). Must be placed after sveltekit(),
// which writes index.html, and before Immich's CSP manifest plugin, which hashes inline styles and scripts.
export const imagePierIndexHtml = (files: FileAccess): Plugin => {
  const buildVersion = Date.now().toString(36);
  let root = '';
  let logger: Logger | undefined;

  return {
    name: 'imagepier:index-html',
    apply: 'build',

    configResolved(config: ResolvedConfig) {
      root = normalizeId(config.root);
      logger = config.logger;
    },

    buildApp: {
      order: 'post',
      handler() {
        const indexHtml = `${root}/build/index.html`;
        const html = files.readFileSync(indexHtml, 'utf8');
        if (!SPLASH_SVG.test(html) || !SPLASH_ANIMATION.test(html)) {
          logger?.warn('ImagePier branding not applied (check after an Immich update): loading screen in app.html');
        }

        files.writeFileSync(indexHtml, rebrandIndexHtml(html, buildVersion));
        return Promise.resolve();
      },
    },
  };
};

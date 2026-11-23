/**
ImagePier e-mails.

Immich renders its e-mails with React Email (`src/emails`). ImagePier replaces the Immich logo, colors, footer and
texts there with its own branding and German or English texts (`IMAGEPIER_LANGUAGE`). Custom templates from
Administration → Settings → Notifications keep working; they replace the text, not the frame.

Optional environment variables:
- `IMAGEPIER_MAIL_NAME`: name shown in e-mails (default "ImagePier")
- `IMAGEPIER_MAIL_COLOR`: accent color of buttons and links, e.g. `#0060a8`
- `IMAGEPIER_MAIL_LOGO_URL`: https URL of a PNG or JPEG logo instead of the embedded default logo

By default the e-mails embed the word mark of the web app (`/imagepier/logo-inline-light.svg`, replaceable by the
logo mount) as PNG attachment (`cid:imagepier-logo`), so it is shown without loading remote images. Without the
file (unit tests, development) the name is shown as text.
*/

import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type { EmailImageAttachment } from 'src/types.js';

const DEFAULT_COLOR = '#6b46e5';

const isGerman = () => (process.env.IMAGEPIER_LANGUAGE ?? 'en').toLowerCase().startsWith('de');

const asColor = (value: string | undefined) =>
  value && /^#[\da-f]{6}$/i.test(value.trim()) ? value.trim() : undefined;

const asHttpsUrl = (value: string | undefined) =>
  value && /^https:\/\/\S+$/i.test(value.trim()) ? value.trim() : undefined;

export type MailBranding = { name: string; color: string; logoUrl?: string };

export const getMailBranding = (): MailBranding => ({
  name: process.env.IMAGEPIER_MAIL_NAME?.trim() || 'ImagePier',
  color: asColor(process.env.IMAGEPIER_MAIL_COLOR) ?? DEFAULT_COLOR,
  logoUrl: asHttpsUrl(process.env.IMAGEPIER_MAIL_LOGO_URL),
});

export const MAIL_LOGO_CID = 'imagepier-logo';

const MAIL_LOGO_HEIGHT = 112;

const getLogoSource = () =>
  join(process.env.IMMICH_BUILD_DATA || '/build', 'www', 'imagepier', 'logo-inline-light.svg');

/** Whether the e-mail layout can reference the embedded default logo. */
export const hasEmbeddedMailLogo = () => existsSync(getLogoSource());

/** Renders the word mark once as PNG into the temp folder (e-mail clients do not show SVG reliably). */
const getMailLogoFile = async () => {
  const source = getLogoSource();
  if (!existsSync(source)) {
    return;
  }
  const target = join(tmpdir(), `imagepier-mail-logo-${Math.trunc(statSync(source).mtimeMs)}.png`);
  if (!existsSync(target)) {
    await sharp(source, { density: 300 }).resize({ height: MAIL_LOGO_HEIGHT }).png().toFile(target);
  }
  return target;
};

/** Attachment for the embedded logo, if the rendered e-mail references it. */
export const getMailLogoAttachment = async (html: string): Promise<EmailImageAttachment | undefined> => {
  if (!html.includes(`cid:${MAIL_LOGO_CID}`)) {
    return;
  }
  const path = await getMailLogoFile();
  return path ? { filename: 'logo.png', path, cid: MAIL_LOGO_CID } : undefined;
};

/** Replaces the logo reference by an inline image, for the template preview in the browser. */
export const inlineMailLogo = async (html: string) => {
  const attachment = await getMailLogoAttachment(html);
  if (!attachment) {
    return html;
  }
  const png = await sharp(attachment.path).toBuffer();
  return html.replaceAll(`cid:${MAIL_LOGO_CID}`, `data:image/png;base64,${png.toString('base64')}`);
};

const en = {
  greeting: 'Hello',
  linkHint: 'If the button does not work, open this link:',
  footer: (name: string) => `This e-mail was sent automatically by ${name}.`,
  welcomeSubject: (name: string) => `Welcome to ${name}`,
  welcomePreview: (name: string) => `Your access to ${name}`,
  welcomeText: 'A new account has been created for you.',
  username: 'Username',
  password: 'Password',
  login: 'Sign in',
  testSubject: (name: string) => `Test e-mail from ${name}`,
  testText: (name: string) => `This is a test e-mail from ${name}.`,
  albumInviteSubject: (album: string) => `You have been added to the album "${album}"`,
  albumInvitePreview: 'You have been added to a shared album.',
  albumInviteText: (sender: string) => `${sender} has added you to the album`,
  albumInviteSuffix: '.',
  albumUpdateSubject: (album: string) => `New photos in the album "${album}"`,
  albumUpdatePreview: 'New photos have been added to a shared album.',
  albumUpdateText: 'New photos have been added to the album',
  albumUpdateSuffix: '.',
  viewAlbum: 'View album',
};

export type MailTexts = typeof en;

const de: MailTexts = {
  greeting: 'Hallo',
  linkHint: 'Falls der Knopf nicht funktioniert, öffne diesen Link:',
  footer: (name: string) => `Diese E-Mail wurde automatisch von ${name} verschickt.`,
  welcomeSubject: (name: string) => `Willkommen bei ${name}`,
  welcomePreview: (name: string) => `Dein Zugang zu ${name}`,
  welcomeText: 'Für dich wurde ein Konto angelegt.',
  username: 'Benutzername',
  password: 'Passwort',
  login: 'Anmelden',
  testSubject: (name: string) => `Test-E-Mail von ${name}`,
  testText: (name: string) => `Das ist eine Test-E-Mail von ${name}.`,
  albumInviteSubject: (album: string) => `Du wurdest zum Album „${album}“ hinzugefügt`,
  albumInvitePreview: 'Du wurdest zu einem geteilten Album hinzugefügt.',
  albumInviteText: (sender: string) => `${sender} hat dich zum Album`,
  albumInviteSuffix: ' hinzugefügt.',
  albumUpdateSubject: (album: string) => `Neue Bilder im Album „${album}“`,
  albumUpdatePreview: 'In einem geteilten Album gibt es neue Bilder.',
  albumUpdateText: 'Im Album',
  albumUpdateSuffix: ' gibt es neue Bilder.',
  viewAlbum: 'Album ansehen',
};

export const getMailTexts = (): MailTexts => (isGerman() ? de : en);

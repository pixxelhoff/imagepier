/**
ImagePier e-mails.

Immich renders its e-mails with React Email (`src/emails`). ImagePier replaces the Immich logo, colors, footer and
texts there with its own branding and German or English texts (`IMAGEPIER_LANGUAGE`). Custom templates from
Administration → Settings → Notifications keep working; they replace the text, not the frame.

Optional environment variables:
- `IMAGEPIER_MAIL_NAME`: name shown in e-mails (default "ImagePier")
- `IMAGEPIER_MAIL_COLOR`: accent color of buttons and links, e.g. `#0060a8`
- `IMAGEPIER_MAIL_LOGO_URL`: https URL of a PNG or JPEG logo; without it the name is shown as a word mark
*/

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

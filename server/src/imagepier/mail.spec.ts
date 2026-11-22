import { getMailBranding, getMailTexts } from 'src/imagepier/mail.js';

describe('ImagePier mails', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('should use the ImagePier branding by default', () => {
    delete process.env.IMAGEPIER_MAIL_NAME;
    delete process.env.IMAGEPIER_MAIL_COLOR;
    delete process.env.IMAGEPIER_MAIL_LOGO_URL;

    expect(getMailBranding()).toEqual({ name: 'ImagePier', color: '#6b46e5', logoUrl: undefined });
  });

  it('should accept a custom name, color and https logo', () => {
    process.env.IMAGEPIER_MAIL_NAME = 'Media Library';
    process.env.IMAGEPIER_MAIL_COLOR = '#0060A8';
    process.env.IMAGEPIER_MAIL_LOGO_URL = 'https://example.com/logo.png';

    expect(getMailBranding()).toEqual({
      name: 'Media Library',
      color: '#0060A8',
      logoUrl: 'https://example.com/logo.png',
    });
  });

  it('should ignore invalid colors and insecure logo urls', () => {
    process.env.IMAGEPIER_MAIL_COLOR = 'red';
    process.env.IMAGEPIER_MAIL_LOGO_URL = 'http://example.com/logo.png';

    expect(getMailBranding()).toEqual(expect.objectContaining({ color: '#6b46e5', logoUrl: undefined }));
  });

  it('should use German texts for IMAGEPIER_LANGUAGE=de', () => {
    process.env.IMAGEPIER_LANGUAGE = 'de';

    expect(getMailTexts().welcomeSubject('ImagePier')).toBe('Willkommen bei ImagePier');
  });
});

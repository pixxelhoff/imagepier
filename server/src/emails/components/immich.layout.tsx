import * as React from 'react';
import { Body, Container, Font, Head, Hr, Html, Img, Preview, Section, Tailwind, Text } from 'react-email';
// @ts-expect-error
import tailwindPresetEmail from 'tailwindcss-preset-email';
import { ImmichFooter } from 'src/emails/components/footer.template.js';
import { getMailBranding } from 'src/imagepier/mail.js';

interface ImmichLayoutProps {
  children: React.ReactNode;
  preview: string;
}

// ImagePier: own branding instead of the Immich logo and colors (see src/imagepier/mail.ts)
export const ImmichLayout = ({ children, preview }: ImmichLayoutProps) => {
  const branding = getMailBranding();
  return (
    <Html>
      <Tailwind
        config={{
          presets: [tailwindPresetEmail],
          theme: {
            extend: {
              colors: {
                // Light Theme
                'immich-primary': branding.color,
                'immich-bg': 'white',
                'immich-fg': 'black',
                'immich-gray': '#F6F6F4',
                'immich-footer': '#6A737D',
              },
              fontFamily: {
                sans: ['Overpass', 'sans-serif'],
                mono: ['Overpass Mono', 'monospace'],
              },
            },
          },
        }}
      >
        <Head>
          <Font
            fontFamily="Overpass"
            fallbackFontFamily="sans-serif"
            webFont={{
              url: 'https://fonts.gstatic.com/s/overpass/v13/qFdH35WCmI96Ajtm81GrU9vyww.woff2',
              format: 'woff2',
            }}
            fontWeight={'100 900'}
            fontStyle="normal"
          />
        </Head>
        <Preview>{preview}</Preview>
        <Body className="bg-[#F4F4f4] my-auto mx-auto px-2 font-sans text-base text-gray-800">
          <Container className="my-[40px] mx-auto max-w-[465px]">
            <Section className="my-6 p-12 border border-gray-200 rounded-[24px] bg-white">
              <Section className="flex justify-center mb-10">
                {branding.logoUrl ? (
                  <Img src={branding.logoUrl} className="h-12 antialiased rounded-none mx-auto" alt={branding.name} />
                ) : (
                  <Text className="m-0 text-center text-3xl font-bold text-[#0f1330]">{branding.name}</Text>
                )}
              </Section>

              {children}
            </Section>

            <Hr className="my-2 text-immich-gray" />

            <ImmichFooter />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

ImmichLayout.PreviewProps = {
  preview: 'This is the preview shown on some mail clients',
  children: <Text>Email body goes here.</Text>,
} as ImmichLayoutProps;

export default ImmichLayout;

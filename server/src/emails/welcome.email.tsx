import * as React from 'react';
import { Link, Section, Text } from 'react-email';
import { ImmichButton } from 'src/emails/components/button.component.js';
import ImmichLayout from 'src/emails/components/immich.layout.js';
import { getMailBranding, getMailTexts } from 'src/imagepier/mail.js';
import { WelcomeEmailProps } from 'src/repositories/email.repository.js';
import { replaceTemplateTags, templatePreview } from 'src/utils/replace-template-tags.js';

export const WelcomeEmail = ({ baseUrl, displayName, username, password, customTemplate }: WelcomeEmailProps) => {
  // ImagePier: German or English texts and own name
  const texts = getMailTexts();
  const { name } = getMailBranding();
  const usableTemplateVariables = {
    displayName,
    username,
    password,
    baseUrl,
  };

  const emailContent = customTemplate ? (
    replaceTemplateTags(customTemplate, usableTemplateVariables)
  ) : (
    <>
      <Text className="m-0">
        {texts.greeting} <strong>{displayName}</strong>!
      </Text>

      <Text>{texts.welcomeText}</Text>

      <Text>
        <strong>{texts.username}</strong>: {username}
        {password && (
          <>
            <br />
            <strong>{texts.password}</strong>: {password}
          </>
        )}
      </Text>
    </>
  );

  return (
    <ImmichLayout
      preview={customTemplate ? templatePreview(customTemplate, usableTemplateVariables) : texts.welcomePreview(name)}
    >
      {customTemplate && (
        <Text className="m-0">
          <div dangerouslySetInnerHTML={{ __html: emailContent }}></div>
        </Text>
      )}

      {!customTemplate && emailContent}

      <Section className="flex justify-center my-6">
        <ImmichButton href={`${baseUrl}/auth/login`}>{texts.login}</ImmichButton>
      </Section>

      <Text className="text-xs">
        {texts.linkHint}
        <br />
        <Link href={baseUrl}>{baseUrl}</Link>
      </Text>
    </ImmichLayout>
  );
};

WelcomeEmail.PreviewProps = {
  baseUrl: 'https://photos.example.com',
  displayName: 'Alan Turing',
  username: 'alan.turing@example.com',
  password: 'mysuperpassword',
} as WelcomeEmailProps;

export default WelcomeEmail;

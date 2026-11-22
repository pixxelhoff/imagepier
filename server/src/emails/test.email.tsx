import * as React from 'react';
import { Link, Row, Text } from 'react-email';
import ImmichLayout from 'src/emails/components/immich.layout.js';
import { getMailBranding, getMailTexts } from 'src/imagepier/mail.js';
import { TestEmailProps } from 'src/repositories/email.repository.js';

// ImagePier: German or English texts and own name
export const TestEmail = ({ baseUrl, displayName }: TestEmailProps) => {
  const texts = getMailTexts();
  const { name } = getMailBranding();
  return (
    <ImmichLayout preview={texts.testText(name)}>
      <Text className="m-0">
        {texts.greeting} <strong>{displayName}</strong>!
      </Text>

      <Text>{texts.testText(name)}</Text>

      <Row>
        <Link href={baseUrl}>{baseUrl}</Link>
      </Row>
    </ImmichLayout>
  );
};

TestEmail.PreviewProps = {
  baseUrl: 'https://photos.example.com',
  displayName: 'Alan Turing',
} as TestEmailProps;

export default TestEmail;

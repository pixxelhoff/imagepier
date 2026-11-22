import * as React from 'react';
import { Img, Link, Section, Text } from 'react-email';
import { ImmichButton } from 'src/emails/components/button.component.js';
import ImmichLayout from 'src/emails/components/immich.layout.js';
import { getMailTexts } from 'src/imagepier/mail.js';
import { AlbumInviteEmailProps } from 'src/repositories/email.repository.js';
import { replaceTemplateTags, templatePreview } from 'src/utils/replace-template-tags.js';

export const AlbumInviteEmail = ({
  baseUrl,
  albumName,
  recipientName,
  senderName,
  albumId,
  cid,
  customTemplate,
}: AlbumInviteEmailProps) => {
  // ImagePier: German or English texts
  const texts = getMailTexts();
  const variables = {
    albumName,
    recipientName,
    senderName,
    albumId,
    baseUrl,
  };

  const emailContent = customTemplate ? (
    replaceTemplateTags(customTemplate, variables)
  ) : (
    <>
      <Text className="m-0">
        {texts.greeting} <strong>{recipientName}</strong>!
      </Text>

      <Text>
        {texts.albumInviteText(senderName)} <strong>{albumName}</strong>
        {texts.albumInviteSuffix}
      </Text>
    </>
  );

  return (
    <ImmichLayout preview={customTemplate ? templatePreview(customTemplate, variables) : texts.albumInvitePreview}>
      {customTemplate && (
        <Text className="m-0">
          <div dangerouslySetInnerHTML={{ __html: emailContent }}></div>
        </Text>
      )}

      {!customTemplate && emailContent}

      {cid && (
        <Section className="flex justify-center my-0">
          <Img
            className="max-w-[300px] w-full rounded-lg"
            src={`cid:${cid}`}
            style={{
              boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px',
            }}
          />
        </Section>
      )}

      <Section className="flex justify-center my-6">
        <ImmichButton href={`${baseUrl}/albums/${albumId}`}>{texts.viewAlbum}</ImmichButton>
      </Section>

      <Text className="text-xs">
        {texts.linkHint}
        <br />
        <Link href={`${baseUrl}/albums/${albumId}`}>{`${baseUrl}/albums/${albumId}`}</Link>
      </Text>
    </ImmichLayout>
  );
};

AlbumInviteEmail.PreviewProps = {
  baseUrl: 'https://photos.example.com',
  albumName: 'Trip to Europe',
  albumId: 'b63f6dae-e1c9-401b-9a85-9dbbf5612539',
  senderName: 'Owner User',
  recipientName: 'Alan Turing',
} as AlbumInviteEmailProps;

export default AlbumInviteEmail;

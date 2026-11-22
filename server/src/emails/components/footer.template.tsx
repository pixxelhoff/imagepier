import * as React from 'react';
import { Text } from 'react-email';
import { getMailBranding, getMailTexts } from 'src/imagepier/mail.js';

// ImagePier: own footer instead of the Immich app store badges and project link
export const ImmichFooter = () => (
  <Text className="text-center text-sm text-immich-footer">{getMailTexts().footer(getMailBranding().name)}</Text>
);

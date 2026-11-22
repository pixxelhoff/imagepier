/**
Whether the signed-in user may upload. Set by the media library entry of the sidebar, which loads the
ImagePier access of the user. The server checks the permission in any case; this only hides the upload button.
*/
class UploadAccess {
  allowed = $state(true);
}

export const uploadAccess = new UploadAccess();

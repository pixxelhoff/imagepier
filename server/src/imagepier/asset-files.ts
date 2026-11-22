import { StorageCore } from 'src/cores/storage.core.js';
import { StorageFolder } from 'src/enum.js';

/**
Files of media library assets.

Immich keeps the files of an asset in folders of its owner (uploads, storage template library, thumbnails and
encoded videos) and removes these folders when the owner is deleted. When an asset changes its owner (assigned to
an area, moved between areas), its files therefore move into the folders of the new owner.
*/

export type FolderOwner = { id: string; storageLabel: string | null };

/** Folders of a user that contain asset files; the order is the same for every user. */
export const getOwnerFolders = (user: FolderOwner) => [
  StorageCore.getLibraryFolder(user),
  StorageCore.getFolderLocation(StorageFolder.Upload, user.id),
  StorageCore.getFolderLocation(StorageFolder.Thumbnails, user.id),
  StorageCore.getFolderLocation(StorageFolder.EncodedVideo, user.id),
];

/**
New path of a file that lies in a folder of another user than the owner, or undefined if the file is already in
the folders of the owner or outside of Immich's folders (e.g. external libraries).
*/
export const getRelocatedPath = (
  path: string,
  owner: FolderOwner,
  users: FolderOwner[],
  getFolders: (user: FolderOwner) => string[] = getOwnerFolders,
) => {
  const ownerFolders = getFolders(owner);
  for (const user of users) {
    if (user.id === owner.id) {
      continue;
    }

    for (const [index, folder] of getFolders(user).entries()) {
      if (path.startsWith(`${folder}/`)) {
        return `${ownerFolders[index]}${path.slice(folder.length)}`;
      }
    }
  }
};

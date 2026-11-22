import { getRelocatedPath, type FolderOwner } from 'src/imagepier/asset-files.js';

const folders = (user: FolderOwner) => [
  `/data/library/${user.storageLabel || user.id}`,
  `/data/upload/${user.id}`,
  `/data/thumbs/${user.id}`,
  `/data/encoded-video/${user.id}`,
];

const owner = { id: 'area', storageLabel: null };
const users = [owner, { id: 'user', storageLabel: 'jane' }, { id: 'other', storageLabel: null }];

describe('getRelocatedPath', () => {
  it('should move files from the folders of the previous owner', () => {
    expect(getRelocatedPath('/data/upload/user/ab/cd/file.jpg', owner, users, folders)).toBe(
      '/data/upload/area/ab/cd/file.jpg',
    );
    expect(getRelocatedPath('/data/thumbs/user/ab/cd/id_preview.jpeg', owner, users, folders)).toBe(
      '/data/thumbs/area/ab/cd/id_preview.jpeg',
    );
    expect(getRelocatedPath('/data/library/jane/2026/file.jpg', owner, users, folders)).toBe(
      '/data/library/area/2026/file.jpg',
    );
  });

  it('should keep files of the owner and outside of the media folders', () => {
    expect(getRelocatedPath('/data/upload/area/ab/cd/file.jpg', owner, users, folders)).toBeUndefined();
    expect(getRelocatedPath('/mnt/photos/file.jpg', owner, users, folders)).toBeUndefined();
    expect(getRelocatedPath('/data/upload/userx/file.jpg', owner, users, folders)).toBeUndefined();
  });
});

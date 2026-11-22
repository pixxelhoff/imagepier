/**
Scope of the Photos page: own assets only, or own assets and the media library.

The media library is a partner that is always shown in the timeline (see the access service).
"My photos" requests the timeline without partners. The choice is kept per browser.
*/

export type PhotosScope = 'own' | 'all';

const STORAGE_KEY = 'imagepier.photos-scope';

const load = (): PhotosScope => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'own' ? 'own' : 'all';
  } catch {
    return 'all';
  }
};

class PhotosScopeState {
  value = $state<PhotosScope>(load());

  get withPartners() {
    return this.value !== 'own';
  }

  set(value: PhotosScope) {
    this.value = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage not available, the choice applies until the page is reloaded
    }
  }
}

export const photosScope = new PhotosScopeState();

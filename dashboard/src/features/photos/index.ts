// A feature határa: az EXIF-olvasás, az orientáció-matematika és a dekódolás a
// modulon belüli részlet, azokat a `photos` moduljai közvetlenül importálják.
export {
  photoDateLabel,
  photoDateText,
  photoLightboxCaption,
  photoThumbnailUrl,
  toPhotoRecord,
  type Photo,
  type PhotoDateLabel,
  type PhotoDates,
  type PhotoThumbnail,
} from './photoMetadata';
export {
  DEFAULT_MAX_IMAGE_SIDE,
  getFileExtension,
  prepareImageUpload,
  type PreparedImageThumbnail,
  type PreparedImageUpload,
  type PrepareImageUploadOptions,
} from './imagePreparation';
export {
  deletePhotoObjects,
  uploadPreparedPhotos,
  PHOTO_THUMBNAIL_SUFFIX,
  type BuildPhotoStoragePathParams,
  type PhotoUploadProgress,
  type PreparedPhoto,
  type UploadedPhotoObject,
  type UploadedPhotoThumbnailObject,
  type UploadPreparedPhotosRequest,
} from './photoUpload';
export {
  usePhotoUpload,
  type BuildStoragePathParams,
  type UploadedPhoto,
  type UploadRequest,
} from './usePhotoUpload';
export { usePhotoPicker, type PhotoPickerSource } from './usePhotoPicker';
export {
  DEFAULT_MAX_SELECTED_PHOTOS,
  appendSelectedPhotos,
  releaseSelectedPhotos,
  removeSelectedPhotoAt,
  selectedPhotoFiles,
  type PhotoSelection,
  type SelectedPhoto,
} from './photoSelection';
export {
  photoDisplayTime,
  resolvePhotoCover,
  sortPhotosNewestFirst,
  type ResolvedPhotoCover,
} from './photoOrder';
export { PhotoLightbox, type PhotoLightboxImage } from './ui/PhotoLightbox';
export {
  PhotoGallery,
  type PhotoGalleryCoverControls,
  type PhotoGalleryProps,
} from './ui/PhotoGallery';
export { PhotoPickerButtons } from './ui/PhotoPickerButtons';
export { PhotoPreviewList } from './ui/PhotoPreviewList';

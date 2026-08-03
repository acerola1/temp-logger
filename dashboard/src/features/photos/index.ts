// A feature határa: az EXIF-olvasás, az orientáció-matematika és a dekódolás a
// modulon belüli részlet, azokat a `photos` moduljai közvetlenül importálják.
export {
  photoDateLabel,
  photoDateText,
  photoLightboxCaption,
  toPhotoRecord,
  type Photo,
  type PhotoDateLabel,
  type PhotoDates,
} from './photoMetadata';
export {
  DEFAULT_MAX_IMAGE_SIDE,
  getFileExtension,
  prepareImageUpload,
  type PreparedImageUpload,
  type PrepareImageUploadOptions,
} from './imagePreparation';
export {
  deletePhotoObjects,
  uploadPreparedPhotos,
  type BuildPhotoStoragePathParams,
  type PhotoUploadProgress,
  type PreparedPhoto,
  type UploadedPhotoObject,
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
export { PhotoLightbox, type PhotoLightboxImage } from './ui/PhotoLightbox';
export { PhotoPickerButtons } from './ui/PhotoPickerButtons';
export { PhotoPreviewList } from './ui/PhotoPreviewList';

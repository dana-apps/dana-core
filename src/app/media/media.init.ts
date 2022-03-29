import { MediaFileService } from './media-file.service';

/**
 * Starts the media-related application services and binds them to the frontend.
 *
 * @returns Service instances for managing media.
 */
export function initMedia() {
  const fileService = new MediaFileService();

  return {
    fileService
  };
}

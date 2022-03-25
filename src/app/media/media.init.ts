import { MediaFileService } from './media-file.service';

export function initMedia() {
  const fileService = new MediaFileService();

  return {
    fileService
  };
}

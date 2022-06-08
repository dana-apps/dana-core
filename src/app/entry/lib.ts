import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { MediaFileService } from '../media/media-file.service';
import { ArchiveService } from '../package/archive.service';

export * from '../../common/asset.interfaces';
export * from '../../common/ipc.interfaces';
export * from '../../common/media.interfaces';
export * from '../../common/media.interfaces';
export * from '../../common/interfaces/archive.interfaces';

export * from '../../common/util/assert';
export * from '../../common/util/error';

export const archives = new ArchiveService();
export const media = new MediaFileService();
export const collections = new CollectionService();
export const assets = new AssetService(collections, media);

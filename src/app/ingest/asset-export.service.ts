import { mapValues } from 'lodash';
import { getExtension } from 'mime';
import { ok } from '../../common/util/error';
import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { saveDanapack, SaveDanapackOpts } from './danapack';

export class AssetExportService {
  constructor(
    private collectionService: CollectionService,
    private assetService: AssetService,
    private mediaService: MediaFileService
  ) {}

  async exportCollection(
    archive: ArchivePackage,
    collectionId: string,
    outpath: string
  ) {
    const { items } = await this.assetService.listAssets(
      archive,
      collectionId,
      { offset: 0, limit: Infinity }
    );

    const output: SaveDanapackOpts = {
      filepath: outpath,
      collection: collectionId,
      records: {}
    };

    for (const asset of items) {
      output.records[asset.id] = {
        metadata: mapValues(asset.metadata, (md) => md.rawValue),
        files: Object.fromEntries(
          asset.media.map((media) => [
            media.id + '.' + getExtension(media.mimeType),
            this.mediaService.getMediaPath(archive, media)
          ])
        )
      };
    }

    await saveDanapack(output);
    return ok();
  }
}

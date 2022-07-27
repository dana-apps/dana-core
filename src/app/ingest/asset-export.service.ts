import { mapValues } from 'lodash';
import { ok } from '../../common/util/error';
import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { PageRangeAll } from '../entry/lib';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { MetadataFileSchema, saveDanapack, SaveDanapackOpts } from './danapack';

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

    const metadata: MetadataFileSchema = {
      collection: collectionId,
      assets: {}
    };
    const output: SaveDanapackOpts = {
      filepath: outpath,
      metadataFiles: [metadata],
      manifest: {
        archiveId: archive.id,
        collections: await this.collectionService
          .allCollections(archive, PageRangeAll)
          .then((x) => x.items)
      }
    };

    for (const asset of items) {
      metadata.assets[asset.id] = {
        metadata: mapValues(asset.metadata, (md) => md.rawValue),
        files: asset.media.map((media) =>
          this.mediaService.getMediaPath(archive, media)
        )
      };
    }

    await saveDanapack(output);
    return ok();
  }
}

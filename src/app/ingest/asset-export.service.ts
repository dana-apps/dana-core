import { mapValues } from 'lodash';
import { ok } from '../../common/util/error';
import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { PageRangeAll } from '../entry/lib';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import {
  MetadataFileSchema,
  MetadataRecordSchema,
  saveDanapack,
  SaveDanapackOpts
} from './danapack';

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

  async exportEntireArchive(archive: ArchivePackage, outpath: string) {
    const collections = await this.collectionService
      .allCollections(archive, PageRangeAll)
      .then((x) => x.items);
    const metadata: MetadataFileSchema[] = [];

    for (const collection of collections) {
      const { items } = await this.assetService.listAssets(
        archive,
        collection.id,
        { offset: 0, limit: Infinity }
      );

      const exports = items.map((asset): [string, MetadataRecordSchema] => [
        asset.id,
        {
          metadata: mapValues(asset.metadata, (md) => md.rawValue),
          accessControl: asset.accessControl,
          redactedProperties: asset.redactedProperties,
          files: asset.media.map((media) =>
            this.mediaService.getMediaPath(archive, media)
          )
        }
      ]);

      metadata.push({
        assets: Object.fromEntries(exports),
        collection: collection.id
      });
    }

    const output: SaveDanapackOpts = {
      filepath: outpath,
      metadataFiles: metadata,
      manifest: {
        archiveId: archive.id,
        collections
      }
    };

    await saveDanapack(output);
    return ok();
  }
}

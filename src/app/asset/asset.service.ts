import { EventEmitter } from 'eventemitter3';
import { Asset } from '../../common/asset.interfaces';
import { ResourceList } from '../../common/resource';
import { MediaFile } from '../media/media-file.entity';
import { ArchivePackage } from '../package/archive-package';
import { AssetEntity } from './asset.entity';

interface CreateAssetOpts {
  /** Metadata to associate with the asset. This must be valid according to the archive schema */
  metadata: Record<string, unknown>;

  /** Media to associate with the asset */
  media?: MediaFile[];
}

export class AssetService extends EventEmitter<AssetEvents> {
  /**
   * Persist an asset to the database, associate it with zero or more media files and index its metadata.
   *
   * Emits `change` to inform observers that the asset has changed.
   *
   * This should fail if the asset's metadata is not valid according to the archive's schema.
   *
   * @param archive The archive to store the asset in.
   * @param param1 Options for
   * @returns An `Asset` object representing the inserted asset.
   */
  async createAsset(
    archive: ArchivePackage,
    { metadata, media = [] }: CreateAssetOpts
  ) {
    const res = await archive.useDb(async (db): Promise<Asset> => {
      const asset = db.create(AssetEntity, {
        mediaFiles: media
      });

      db.persist(asset);

      return {
        id: asset.id,
        metadata: metadata,
        media: media.map((m) => ({
          id: m.id,
          mimeType: m.mimeType,
          type: 'image'
        }))
      };
    });

    this.emit('change', {
      created: [res.id]
    });

    return res;
  }

  /**
   * List assets in the archive.
   *
   * @returns ResourceList representing the query.
   */
  async listAssets(
    archive: ArchivePackage,
    paginationToken?: string
  ): Promise<ResourceList<Asset>> {
    return archive.useDb(async () => {
      const entities = await archive.list(
        AssetEntity,
        {},
        {
          populate: ['mediaFiles'],
          paginationToken
        }
      );

      return {
        ...entities,
        items: await Promise.all(
          entities.items.map(async (entity) => ({
            id: entity.id,
            media: Array.from(entity.mediaFiles).map((file) => ({
              id: file.id,
              type: 'image',
              mimeType: file.mimeType
            })),
            metadata: {}
          }))
        )
      };
    });
  }
}

interface AssetEvents {
  change: [AssetsChangedEvent];
}

/** Emitted when the assets managed by the archive have changed */
export interface AssetsChangedEvent {
  /** Ids of newly created assets */
  created: string[];
}

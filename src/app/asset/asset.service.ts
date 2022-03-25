import { EventEmitter } from 'eventemitter3';
import { Asset } from '../../common/asset.interfaces';
import { ResourceList } from '../../common/resource';
import { MediaFile } from '../media/media-file.entity';
import { ArchivePackage } from '../package/archive-package';
import { AssetEntity, AssetStringProperty } from './asset.entity';

interface CreateAssetOpts {
  metadata: Record<string, unknown>;
  media?: MediaFile[];
}

export class AssetService extends EventEmitter<AssetEvents> {
  async createAsset(
    archive: ArchivePackage,
    { metadata, media = [] }: CreateAssetOpts
  ) {
    const res = await archive.useDb(async (db): Promise<Asset> => {
      const asset = db.create(AssetEntity, {
        mediaFiles: media
      });

      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string') {
          const property = db.create(AssetStringProperty, {
            asset,
            key,
            value
          });
          db.persist(property);
        }
      }

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

  async listAssets(
    archive: ArchivePackage,
    paginationToken?: string
  ): Promise<ResourceList<Asset>> {
    return archive.useDb(async () => {
      const entities = await archive.list(
        AssetEntity,
        {},
        {
          populate: AssetEntity.defaultPopulate,
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
            metadata: await entity.loadMetadata()
          }))
        )
      };
    });
  }
}

interface AssetEvents {
  change: [AssetsChangedEvent];
}

export interface AssetsChangedEvent {
  created: string[];
}

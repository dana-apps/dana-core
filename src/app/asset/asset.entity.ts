import { Collection, Entity, OneToMany, PrimaryKey } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { MediaFile } from '../media/media-file.entity';

/**
 * Store an individual asset and its metadata in the database.
 */
@Entity({
  tableName: 'asset'
})
export class AssetEntity {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @OneToMany(() => MediaFile, (media) => media.asset)
  mediaFiles = new Collection<MediaFile>(this);
}

import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { tuple } from '../../common/util/collection';
import { MediaFile } from '../media/media-file.entity';

@Entity({
  tableName: 'asset'
})
export class AssetEntity {
  static defaultPopulate = tuple('mediaFiles', 'stringProperties');

  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @OneToMany(() => MediaFile, (media) => media.asset)
  mediaFiles = new Collection<MediaFile>(this);

  @OneToMany(() => AssetStringProperty, (prop) => prop.asset)
  stringProperties = new Collection<AssetStringProperty>(this);

  async loadMetadata() {
    return {
      ...(await this.buildMetadata(this.stringProperties))
    };
  }

  private async buildMetadata<T extends AssetProperty>(
    collection: Collection<T, unknown>
  ) {
    await collection.loadItems();
    return Object.fromEntries(
      Array.from(collection).map((md) => [md.key, md.value])
    );
  }
}

interface AssetProperty<T = unknown> {
  key: string;
  value: T;
}

@Entity({
  tableName: 'asset_string_property'
})
export class AssetStringProperty implements AssetProperty<string> {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @Property({ type: 'string', nullable: false })
  key!: string;

  @Property({ type: 'string', nullable: false })
  value!: string;

  @ManyToOne(() => AssetEntity, {
    nullable: false,
    onDelete: 'cascade'
  })
  asset!: AssetEntity;
}

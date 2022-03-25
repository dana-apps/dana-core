import {
  PrimaryKey,
  Property,
  ManyToOne,
  OneToMany,
  Collection,
  Enum,
  Entity
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Asset } from '../../common/asset.interfaces';
import { FileImportError, ImportPhase } from '../../common/ingest.interfaces';
import { MediaFile } from '../media/media-file.entity';

/** A bulk import session where multiple assets are imported */
@Entity({ tableName: 'import_session' })
export class ImportSessionEntity {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  /** Absolute path of the root file to import assets from */
  @Property({ type: 'string', nullable: false })
  basePath!: string;

  /** Assets imported by the session */
  @OneToMany(() => AssetImportEntity, (asset) => asset.session)
  assets = new Collection<AssetImportEntity>(this);

  @Enum({ type: () => ImportPhase, nullable: false, items: () => ImportPhase })
  phase!: ImportPhase;
}

/** Track the progress of an imported asset */
@Entity({ tableName: 'asset_import' })
export class AssetImportEntity {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @Property({ type: 'string', nullable: false })
  path!: string;

  @ManyToOne(() => ImportSessionEntity, {
    nullable: false,
    onDelete: 'cascade'
  })
  session!: ImportSessionEntity;

  @Property({ type: 'json' })
  metadata!: Record<string, unknown>;

  /** Files detected */
  @OneToMany(() => FileImport, (file) => file.asset)
  files = new Collection<FileImport>(this);

  @Enum({ type: () => ImportPhase, nullable: false, items: () => ImportPhase })
  phase!: ImportPhase;
}

/** A file referenced by an imported asset */
@Entity({ tableName: 'file_import' })
export class FileImport {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @Property({ type: 'string', nullable: false })
  path!: string;

  @ManyToOne(() => AssetImportEntity, { nullable: false, onDelete: 'cascade' })
  asset!: AssetImportEntity;

  @ManyToOne(() => MediaFile, { nullable: true, onDelete: 'set null' })
  media?: MediaFile;

  @Enum({
    type: () => FileImportError,
    nullable: true,
    items: () => FileImportError
  })
  error?: FileImportError;
}

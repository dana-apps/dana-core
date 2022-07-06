import express from 'express';
import http from 'http';

import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { ArchiveService } from '../package/archive.service';
import { CreateSyncOpts, createSyncServer } from '../sync/sync-server.handler';

export * from '../../common/asset.interfaces';
export * from '../../common/ipc.interfaces';
export * from '../../common/media.interfaces';
export * from '../../common/media.interfaces';
export * from '../../common/interfaces/archive.interfaces';

export * from '../../common/util/assert';
export * from '../../common/util/error';

export { ArchivePackage };

export const archives = new ArchiveService();
export const media = new MediaFileService();
export const collections = new CollectionService();
export const assets = new AssetService(collections, media);

export function createHttpSync(config: CreateSyncOpts) {
  return createSyncServer(assets, media, config);
}

export function startHttpSync(config: CreateSyncOpts & { port: string }) {
  const app = express();
  app.use(createHttpSync(config));

  return new Promise<http.Server>((resolve) => {
    const server: http.Server = app.listen(config.port ?? 1121, () =>
      resolve(server)
    );
  });
}

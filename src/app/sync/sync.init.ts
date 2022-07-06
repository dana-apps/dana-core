import { randomUUID } from 'crypto';
import { debounce } from 'lodash';
import fetch from 'cross-fetch';
import FormData from 'form-data';
import { Readable } from 'stream';
import { error, Result } from '../../common/util/error';
import { AssetService } from '../asset/asset.service';
import { CollectionService } from '../asset/collection.service';
import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { SyncClient, SyncTransport } from './sync-client.service';
import { Dict } from '../../common/util/types';

const SYNC_DISABLED_ERROR = 'Sync not configured';

export function initSync(
  collections: CollectionService,
  assets: AssetService,
  media: MediaFileService
) {
  const transport: SyncTransport = {
    async beginSync(archive, request) {
      return syncRequest(archive, '/', request);
    },
    async acceptAssets(archive, id, request) {
      return syncRequest(archive, `/${id}/assets`, request);
    },
    async acceptMedia(archive, id, request, file) {
      return syncRequest(archive, `/${id}/media`, request, file);
    },
    async commit(archive, id) {
      return syncRequest(archive, `/${id}/commit`);
    }
  };

  const syncClient = new SyncClient(transport, collections, media);
  const debouncedSync = debounce(
    (archive: ArchivePackage) => syncClient.sync(archive),
    5_000
  );

  collections.on('change', ({ archive }) => {
    if (archive.syncConfig) {
      debouncedSync(archive);
    }
  });

  assets.on('change', ({ archive }) => {
    if (archive.syncConfig) {
      debouncedSync(archive);
    }
  });

  media.on('change', ({ archive }) => {
    if (archive.syncConfig) {
      debouncedSync(archive);
    }
  });

  return {
    syncClient
  };
}

async function syncRequest<T>(
  { syncConfig }: ArchivePackage,
  endpoint: string,
  data?: object,
  file?: { stream: Readable; size: number }
): Promise<Result<T>> {
  if (!syncConfig) {
    return error(SYNC_DISABLED_ERROR);
  }

  let body: BodyInit | undefined;
  const headers: Dict = {};

  if (file) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    formData.append('file_' + randomUUID(), file.stream, {
      knownLength: file.size
    });
    body = formData as unknown as BodyInit;
    Object.assign(headers, formData.getHeaders());
  } else if (data) {
    body = JSON.stringify(data);
    headers['content-type'] = 'application/json';
  }

  const res = await fetch(syncConfig.url + endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${syncConfig.auth}`,
      accept: 'application/json',
      ...headers
    },
    body
  });

  if (!res.ok) {
    return error(res.statusText);
  }

  return res.json() as Promise<Result<T>>;
}

import express from 'express';
import * as bodyparser from 'body-parser';
import busboy from 'busboy';
import { RequestListener } from 'http';
import { z } from 'zod';

import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { SyncServer, SyncServerConfig } from './sync-server.service';
import {
  AcceptAssetRequest,
  AcceptMediaRequest,
  SyncRequest
} from '../../common/sync.interfaces';
import { AssetService } from '../asset/asset.service';

export interface CreateSyncOpts extends SyncServerConfig {
  archive: ArchivePackage;
  secretKey: string;
}

export function createSyncServer(
  assets: AssetService,
  media: MediaFileService,
  { secretKey, archive, ...config }: CreateSyncOpts
): RequestListener {
  const server = express();
  const syncer = new SyncServer(assets, media, config);

  server.use((req, res, next) => {
    if (req.get('authorization') !== `Bearer ${secretKey}`) {
      return res.sendStatus(401);
    }

    next();
  });

  server.post(
    '/',
    bodyparser.json(),
    validateRequest(SyncRequest),
    async (req, res) => {
      try {
        res.json(await syncer.beginSync(archive, req.body));
      } catch (error) {
        console.error(error);
        return res.sendStatus(500);
      }
    }
  );

  server.post(
    '/:id/assets',
    bodyparser.json(),
    validateRequest(AcceptAssetRequest),
    async (req, res) => {
      try {
        res.json(await syncer.acceptAssets(archive, req.params.id, req.body));
      } catch (error) {
        console.error(error);
        return res.sendStatus(500);
      }
    }
  );

  server.post('/:id/media', (req, res) => {
    const bb = busboy({ headers: req.headers });
    let metadata: unknown;

    bb.on('file', async (_, file) => {
      try {
        const data = AcceptMediaRequest.safeParse(metadata);
        if (!data.success) {
          console.error(data.error);
          res.status(400).json(data.error);
          return;
        }

        res.json(
          await syncer.acceptMedia(archive, req.params.id, data.data, file)
        );
      } catch (error) {
        console.error(error);
        return res.sendStatus(500);
      } finally {
        file.resume();
      }
    });

    bb.on('field', (key, val) => {
      if (key === 'data') {
        metadata = JSON.parse(val);
      }
    });

    req.pipe(bb);
  });

  server.post('/:id/commit', async (req, res) => {
    try {
      res.json(await syncer.commit(archive, req.params.id));
    } catch (error) {
      console.error(error);
      return res.sendStatus(500);
    }
  });

  return server;
}

function validateRequest(type: z.Schema, key?: string): express.RequestHandler {
  return (req, res, next) => {
    const parseRes = type.safeParse(key ? req.body[key] : req.body);

    if (!parseRes.success) {
      console.error(parseRes.error);
      return res.status(400).json(parseRes.error);
    }

    if (key) {
      req.body[key] = parseRes.data;
    } else {
      req.body = parseRes.data;
    }

    next();
  };
}

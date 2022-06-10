import express from 'express';
import * as bodyparser from 'body-parser';
import busboy from 'busboy';
import { RequestListener } from 'http';
import { z } from 'zod';

import { MediaFileService } from '../media/media-file.service';
import { ArchivePackage } from '../package/archive-package';
import { SyncServer } from './sync-server.service';
import {
  AcceptAssetRequest,
  AcceptMediaRequest,
  SyncRequest
} from '../../common/sync.interfaces';

export interface CreateSyncOpts {
  archive: ArchivePackage;
  secretKey: string;
}

export function createSyncServer(
  media: MediaFileService,
  { secretKey, archive }: CreateSyncOpts
): RequestListener {
  const server = express();
  const syncer = new SyncServer(media);

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
          res.writeHead(400);
          res.json(data.error);
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
      res.writeHead(400);
      return res.json(parseRes.error);
    }

    if (key) {
      req.body[key] = parseRes.data;
    } else {
      req.body = parseRes.data;
    }

    next();
  };
}

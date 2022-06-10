import { z } from 'zod';
import { AccessControl, Asset, Collection } from './asset.interfaces';
import { Media } from './media.interfaces';

export const SyncedCollection = Collection.and(
  z.object({
    parent: z.string().optional()
  })
);
export type SyncedCollection = z.TypeOf<typeof SyncedCollection>;

export const SyncedAsset = z.object({
  sha256: z.string(),
  id: z.string()
});
export type SyncedAsset = z.TypeOf<typeof SyncedAsset>;

export const SyncedMedia = z.object({
  id: z.string(),
  sha256: z.string()
});
export type SyncedMedia = z.TypeOf<typeof SyncResponse>;

export const SyncRequest = z.object({
  collections: SyncedCollection.array(),
  assets: SyncedAsset.array(),
  media: SyncedMedia.array()
});
export type SyncRequest = z.TypeOf<typeof SyncRequest>;

export const SyncResponse = z.object({
  id: z.string(),
  wantMedia: z.string().array(),
  wantAssets: z.string().array()
});
export type SyncResponse = z.TypeOf<typeof SyncResponse>;

export const AcceptedAsset = z.object({
  id: z.string(),
  collection: z.string(),
  metadata: z.record(z.unknown().array()),
  accessControl: z.nativeEnum(AccessControl)
});
export type AcceptedAsset = z.TypeOf<typeof AcceptedAsset>;

export const AcceptAssetRequest = z.object({
  assets: AcceptedAsset.array()
});
export type AcceptAssetRequest = z.TypeOf<typeof AcceptAssetRequest>;

export const AcceptedMedia = z.object({
  id: z.string(),
  sha256: z.string(),
  assetId: z.string(),
  mimeType: z.string()
});

export type AcceptedMedia = z.TypeOf<typeof AcceptedMedia>;

export const AcceptMediaRequest = z.object({
  metadata: AcceptedMedia
});
export type AcceptMediaRequest = z.TypeOf<typeof AcceptMediaRequest>;

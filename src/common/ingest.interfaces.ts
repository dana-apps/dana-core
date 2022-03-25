import { z } from 'zod';
import { RequestType, ResponseType, RpcInterface } from './ipc.interfaces';
import { Asset } from './asset.interfaces';
import { FetchError, Result } from './util/error';
import { ResourceList } from './resource';

export enum ImportPhase {
  READ_METADATA = 'READ_METADATA',
  READ_FILES = 'READ_FILES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum FileImportError {
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
  IO_ERROR = 'IO_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR'
}

export enum CommitIngestSessionError {
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export const IngestedAsset = z.object({
  ...Asset.shape,
  phase: z.nativeEnum(ImportPhase)
});
export type IngestedAsset = z.TypeOf<typeof IngestedAsset>;

export const IngestSession = z.object({
  id: z.string(),
  basePath: z.string(),
  phase: z.nativeEnum(ImportPhase),
  filesRead: z.optional(z.number()),
  totalFiles: z.optional(z.number())
});
export type IngestSession = z.TypeOf<typeof IngestSession>;

/**
 * Start a new ingest session, importing the assets and metadata located at `basePath`
 *
 * Returns the id of the newly created session.
 **/
export const StartIngest = RpcInterface({
  id: 'ingest/start',
  request: z.object({
    basePath: z.string()
  }),
  response: IngestSession,
  error: z.nativeEnum(FetchError)
});
export type StartIngestRequest = RequestType<typeof StartIngest>;
export type StartIngestResponse = ResponseType<typeof StartIngest>;

/**
 * Get the ingest session identified by `sessionId`.
 **/
export type GetIngestSessionRequest = RequestType<typeof GetIngestSession>;
export type GetIngestSessionResponse = ResponseType<typeof GetIngestSession>;
export const GetIngestSession = RpcInterface({
  id: 'ingest/get',
  request: z.object({
    sessionId: z.string()
  }),
  response: IngestSession
});

/**
 * Get the ingest session identified by `sessionId`.
 **/
export type ListIngestSessionRequest = RequestType<typeof ListIngestSession>;
export type ListIngestSessionResponse = ResponseType<typeof ListIngestSession>;
export const ListIngestSession = RpcInterface({
  id: 'ingest/get',
  request: z.object({}),
  response: ResourceList(IngestSession)
});

/**
 * Complete the ingest session.
 *
 * Moves the assets in the ingest session `sessionId` into the main database and deletes the session.
 **/
export const CommitIngestSession = RpcInterface({
  id: 'ingest/commit',
  request: z.object({
    sessionId: z.string()
  }),
  response: z.object({}),
  error: z.nativeEnum(CommitIngestSessionError)
});
export type CommitIngestSessionRequest = RequestType<
  typeof CommitIngestSession
>;
export type CommitIngestSessionResponse = ResponseType<
  typeof CommitIngestSession
>;

/**
 * Complete the ingest session.
 *
 * Moves the assets in the ingest session `sessionId` into the main database and deletes the session.
 **/
export const CancelIngestSession = RpcInterface({
  id: 'ingest/cancel',
  request: z.object({
    sessionId: z.string()
  }),
  response: z.object({})
});
export type CancelIngestSessionRequest = RequestType<
  typeof CancelIngestSession
>;
export type CancelIngestSessionResponse = ResponseType<
  typeof CancelIngestSession
>;

/**
 * Complete the ingest session.
 *
 * Moves the assets in the ingest session `sessionId` into the main database and deletes the session.
 **/
export const ListIngestAssets = RpcInterface({
  id: 'ingest/list-assets',
  request: z.object({
    sessionId: z.string()
  }),
  response: ResourceList(IngestedAsset)
});
export type ListIngestAssetsRequest = RequestType<typeof ListIngestAssets>;
export type ListIngestAssetsResponse = ResponseType<typeof ListIngestAssets>;

export type FileImportResult<T> = Result<T, FileImportError>;

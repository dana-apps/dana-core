import { z } from 'zod';
import { RequestType, ResponseType, RpcInterface } from './ipc.interfaces';
import { Asset, ValidationError } from './asset.interfaces';
import { FetchError, Result } from './util/error';
import { ResourceList } from './resource';

/**
 * Current state of something being imported into the archive (a media file, asset or a collection of these)
 */
export enum IngestPhase {
  READ_METADATA = 'READ_METADATA',
  READ_FILES = 'READ_FILES',
  PROCESS_FILES = 'PROCESS_FILES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

/**
 * Represent an error that prevents an item from being imported into the archive.
 */
export enum IngestError {
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
  IO_ERROR = 'IO_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR'
}

/**
 * Represent an error that occurs while attempting to commit a collection of ingested assets.
 */
export enum CommitIngestError {
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * Represent an error that occurs while attempting to start an ingest operation.
 */
export enum StartIngestError {
  CANCELLED = 'CANCELLED'
}

/**
 * Augment the Asset interface with additional details about ingesting it.
 */
export const IngestedAsset = z.object({
  ...Asset.shape,

  /** The current ingest phase of the assset */
  phase: z.nativeEnum(IngestPhase),

  /** Validation errors */
  validationErrors: ValidationError.optional().nullable()
});
export type IngestedAsset = z.TypeOf<typeof IngestedAsset>;

/**
 * Represent a collection of assets that are staged for adding to the archive
 **/
export const IngestSession = z.object({
  /** Unique id for the session */
  id: z.string(),

  /** Human-readable name that identifies the session */
  title: z.string(),

  /** Root directory containing the source media and metadata */
  basePath: z.string(),

  /** The top-level state of the ingest session */
  phase: z.nativeEnum(IngestPhase),

  /** The total number of files that have been read (whether successful or not) */
  filesRead: z.number(),

  /** The total number of files are referenced by metadata entries. Undefined if this is not yet known. */
  totalFiles: z.optional(z.number()),

  /** False if there are validation errors, otherwise true */
  valid: z.boolean()
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
    basePath: z.string().optional()
  }),
  response: IngestSession,
  error: z.nativeEnum(FetchError).or(z.nativeEnum(StartIngestError))
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
    id: z.string()
  }),
  response: IngestSession
});

/**
 * List all ingest sessions in an archive.
 **/
export type ListIngestSessionRequest = RequestType<typeof ListIngestSession>;
export type ListIngestSessionResponse = ResponseType<typeof ListIngestSession>;
export const ListIngestSession = RpcInterface({
  id: 'ingest/list',
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
  error: z.nativeEnum(CommitIngestError)
});
export type CommitIngestSessionRequest = RequestType<
  typeof CommitIngestSession
>;
export type CommitIngestSessionResponse = ResponseType<
  typeof CommitIngestSession
>;

/**
 * Cancel the ingest session.
 *
 * Remove a session and delete its associated metadata and media files. The source directory is not affected.
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
 * List the assets in an active ingest session.
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

export type FileImportResult<T = unknown> = Result<T, IngestError>;

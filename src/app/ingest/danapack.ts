import StreamZip from 'node-stream-zip';
import ZipStream from 'zip-stream';
import zipPath from 'path/posix';
import systemPath, { extname } from 'path';
import * as SecureJSON from 'secure-json-parse';
import { z } from 'zod';
import { AccessControl, Collection } from '../../common/asset.interfaces';
import { error, ok, Result } from '../../common/util/error';
import { createReadStream, createWriteStream } from 'fs';
import { streamEnded } from '../util/stream-utils';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

/**
 * A Danapack file is a zipped bundle of asset metadata and media files with a defined internal file structure.
 *
 * It must have the extension `.danapack` to be used by Dana Core.
 *
 * The archive structure is as follows:
 *
 * ```
 * + [root directory]
 *   ? manifest.json
 *   + metadata
 *     - collection1.json
 *     - collection2.json
 *   + media
 *     - file1
 *     - file2
 *     ...
 * ```
 * The root directory may have any name, but must be present. The metadata.json and media entries should not be at the
 * root of the archive.
 */

export interface Danapack {
  manifest: Lazy<ManifestFileSchema>;
  metadataEntries: Lazy<MetadataFileSchema>[];
  extractMedia: (slug: string, dest: string) => Promise<void>;
}

export async function openDanapack(filepath: string): Promise<Danapack> {
  const zip = new StreamZip.async({ file: filepath });
  const entries = Object.fromEntries(
    Object.keys(await zip.entries()).map((e) => [
      zipPath.join(...e.split('/').slice(1)),
      e
    ])
  );

  const extractMedia = async (slug: string, dest: string) => {
    const entry = entries[zipPath.join('media', slug)];
    const stream = createWriteStream(dest);
    const zipStream = await zip.stream(entry);

    zipStream.pipe(stream);
    await streamEnded(stream);
  };

  return {
    manifest: lazyLoad(zip, entries['manifest.json'], ManifestFileSchema),
    metadataEntries: Object.entries(entries)
      .filter(([key, _]) => key.startsWith('metadata/'))
      .map(([_, val]) => lazyLoad(zip, val, MetadataFileSchema)),
    extractMedia
  };
}

export interface SaveDanapackOpts {
  filepath: string;
  manifest: ManifestFileSchema;
  metadataFiles:
    | AsyncIterable<MetadataFileSchema>
    | Iterable<MetadataFileSchema>;
}

export async function saveDanapack({
  filepath,
  manifest,
  metadataFiles
}: SaveDanapackOpts) {
  const rootDir = systemPath.basename(filepath, systemPath.extname(filepath));
  const zip = new ZipStream();
  const writer = createWriteStream(filepath);
  zip.pipe(writer);

  await writeZip(zip, `${rootDir}/manifest.json`, manifest, ManifestFileSchema);

  let mdIndex = 1;
  for await (const metadataFile of metadataFiles) {
    for (const record of Object.values(metadataFile.assets)) {
      if (record.files) {
        let fileIndex = 0;
        for (const mediaFilepath of record.files) {
          const basename = randomUUID() + extname(mediaFilepath);
          await writeZip(
            zip,
            `${rootDir}/media/${basename}`,
            createReadStream(mediaFilepath)
          );

          record.files[fileIndex] = basename;
          fileIndex += 1;
        }
      }

      await writeZip(
        zip,
        `${rootDir}/metadata/${mdIndex}.json`,
        metadataFile,
        MetadataFileSchema
      );

      mdIndex += 1;
    }
  }

  zip.finalize();
  await streamEnded(writer);
}

type Lazy<T> = () => Promise<Result<T>>;

/** Helper for lazily reading from zip file */
const lazyLoad =
  <T>(zip: StreamZip.StreamZipAsync, entry: string, schema: z.Schema<T>) =>
  async () => {
    const data = await zip.entryData(entry);

    const json = SecureJSON.safeParse(data);
    if (!json) {
      return error('parse-error');
    }

    const contents = schema.safeParse(json);
    if (!contents.success) {
      return error('parse-error');
    }

    return ok(contents.data);
  };

/** Helper for writing to zip file */
const writeZip = async <T>(
  zip: ZipStream,
  filepath: string,
  content: T,
  schema?: z.Schema<T>
) => {
  const data = schema
    ? Buffer.from(JSON.stringify(schema.parse(content)), 'utf-8')
    : (content as unknown as Buffer | Readable);

  await new Promise<void>((resolve, reject) => {
    zip.entry(data, { name: filepath }, (err) =>
      err ? reject(err) : resolve()
    );
  });
};

/**
 * Structure of a metadata record in a DanaPack file.
 *
 * A metadata document contains the metadata and media files that compose an imported asset.
 *
 * It has the following requirements:
 *
 * - Metadata MUST be specified as a json map from import references to asset records.
 * - Metadata need not fit any schema otherwise – it will be validated against the schema as part of the import and
 *   edited by the operator.
 * - An imported asset MAY have zero, one or multiple associated media files.
 * - Media files MUST be in a supported format.
 * - Media files MUST be specified as a relative path (using posix conventions) from the media directory of the dana
 *   package.
 **/
export const MetadataRecordSchema = z.object({
  metadata: z.record(z.array(z.unknown())),
  files: z.optional(z.array(z.string())),
  redactedProperties: z.array(z.string()).optional(),
  accessControl: z.nativeEnum(AccessControl).optional()
});
export type MetadataRecordSchema = z.TypeOf<typeof MetadataRecordSchema>;

/**
 * Structure of the metadata.json entry in a DanaPack file.
 */
export const MetadataFileSchema = z.object({
  collection: z.string().optional(),
  assets: z.record(MetadataRecordSchema)
});
export type MetadataFileSchema = z.TypeOf<typeof MetadataFileSchema>;

/**
 * Structure of the metadata.json entry in a DanaPack file.
 */
export const ManifestFileSchema = z.object({
  archiveId: z.string().optional(),
  collections: Collection.array()
});
export type ManifestFileSchema = z.TypeOf<typeof ManifestFileSchema>;

import AdmZip from 'adm-zip';
import zipPath from 'path/posix';
import systemPath from 'path';
import { z } from 'zod';
import { Dict } from '../../common/util/types';

/**
 * A DanaPack file is a zipped bundle of asset metadata and media files with a defined internal file structure.
 *
 * It must have the extension `.danapack` to be used by Dana Core.
 *
 * The archive structure is as follows:
 *
 * ```
 * + [root directory]
 *   - metadata.json
 *   + media
 *     - file1
 *     - file2
 *     ...
 * ```
 * The root directory may have any name, but must be present. The metadata.json and media entries should not be at the
 * root of the archive.
 */
export type DanaPack = ReturnType<typeof openDanapack>;

export function openDanapack(filepath: string) {
  const zip = new AdmZip(filepath);
  const entries = Object.fromEntries(
    zip
      .getEntries()
      .map((e) => [zipPath.join(...e.entryName.split('/').slice(1)), e])
  ) as Dict<AdmZip.IZipEntry>;

  return {
    zipFile: zip,
    metadataEntry: entries['metadata.json'],
    getMedia: (slug: string) => entries[zipPath.join('media', slug)]
  };
}

export interface SaveDanapackOpts {
  collection?: string;
  filepath: string;
  records: Dict<{ metadata: Dict<unknown[]>; files?: Dict<string, string> }>;
}

export async function saveDanapack({
  filepath,
  collection,
  records
}: SaveDanapackOpts) {
  const rootDir = systemPath.basename(filepath);
  const md: MetadataFileSchema = {
    collection,
    assets: {}
  };

  const zip = new AdmZip();

  for (const [id, record] of Object.entries(records)) {
    md.assets[id] = {
      metadata: record.metadata,
      files: []
    };

    if (record.files) {
      for (const [slug, path] of Object.entries(record.files)) {
        zip.addLocalFile(path, zipPath.join(rootDir, 'media', slug));
      }
    }
  }

  const metadata = Buffer.from(
    JSON.stringify(MetadataFileSchema.parse(md)),
    'utf-8'
  );

  zip.addFile(zipPath.join(rootDir, 'metadata.json'), metadata);
  await zip.writeZipPromise(filepath);
}

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
  files: z.optional(z.array(z.string()))
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

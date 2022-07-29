import { requireSuccess } from '../../../test/result';
import { getTempfiles } from '../../../test/tempfile';
import { AssetService } from '../../asset/asset.service';
import { CollectionService } from '../../asset/collection.service';
import { MediaFileService } from '../../media/media-file.service';
import { ArchiveService } from '../../package/archive.service';
import { AssetExportService } from '../asset-export.service';
import { AssetIngestService } from '../asset-ingest.service';
import { BooststrapService } from '../bootstrap.service';

describe('bootstrap', () => {
  test('bootstraps an archive from a danapack, exports it then bootstraps again', async () => {
    const fixture1 = await setup();
    const fixture2 = await setup();
    const archive1 = requireSuccess(
      await fixture1.bootstrap.boostrapArchiveFromDanapack(
        require.resolve('./fixtures/bootstrap-fixture.danapack'),
        fixture2.tempfiles()
      )
    );

    const danapackLocation = fixture1.tempfiles() + '.danapack';
    await fixture1.exports.exportEntireArchive(archive1, danapackLocation);

    const archive2 = requireSuccess(
      await fixture2.bootstrap.boostrapArchiveFromDanapack(
        danapackLocation,
        fixture2.tempfiles()
      )
    );

    expect(archive2).toBe(archive2);
    const keywords = await fixture2.assets.listAssets(
      archive2,
      'cc40501b-2577-4d14-9157-8c435001c673'
    );
    expect(keywords.items).toHaveLength(1);

    const assets = await fixture2.assets.listAssets(
      archive2,
      'e2216ff2-095d-4fa6-97ce-dca4a77a5eac'
    );
    expect(assets.items).toHaveLength(2);
    expect(
      assets.items.map(
        (x) =>
          x.metadata['24b77aa4-3752-4daf-9b88-70b879e6b876']
            ?.presentationValue[0]?.label
      )
    ).toContain('My Keyword');
  });
});

async function setup() {
  const tempfiles = await getTempfiles();
  const archive = new ArchiveService();
  const collections = new CollectionService();
  const media = new MediaFileService();
  const assets = new AssetService(collections, media);
  const exports = new AssetExportService(collections, assets, media);
  const ingest = new AssetIngestService(media, assets, collections);
  const bootstrap = new BooststrapService(archive, collections, ingest);

  return {
    tempfiles,
    exports,
    assets,
    bootstrap
  };
}

import { requireSuccess } from '../../../test/result';
import { getTempfiles } from '../../../test/tempfile';
import { AssetService } from '../../asset/asset.service';
import { CollectionService } from '../../asset/collection.service';
import { MediaFileService } from '../../media/media-file.service';
import { ArchiveService } from '../../package/archive.service';
import { AssetIngestService } from '../asset-ingest.service';
import { BooststrapService } from '../bootstrap.service';

describe('bootstrap', () => {
  test('bootstraps an archive from a danapack', async () => {
    const fixture = await setup();
    const archive = requireSuccess(
      await fixture.bootstrap.boostrapArchiveFromDanapack(
        require.resolve('./fixtures/bootstrap-fixture.danapack'),
        fixture.tempfiles()
      )
    );

    expect(archive).toBe(archive);
    const keywords = await fixture.assets.listAssets(
      archive,
      'cc40501b-2577-4d14-9157-8c435001c673'
    );
    expect(keywords.items).toHaveLength(1);

    const assets = await fixture.assets.listAssets(
      archive,
      'e2216ff2-095d-4fa6-97ce-dca4a77a5eac'
    );
    expect(assets.items).toHaveLength(2);
  });
});

async function setup() {
  const tempfiles = await getTempfiles();
  const archive = new ArchiveService();
  const collections = new CollectionService();
  const media = new MediaFileService();
  const assets = new AssetService(collections, media);
  const ingest = new AssetIngestService(media, assets, collections);
  const bootstrap = new BooststrapService(archive, collections, ingest);

  return {
    tempfiles,
    assets,
    bootstrap
  };
}

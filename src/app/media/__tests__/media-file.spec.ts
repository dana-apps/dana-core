import { existsSync, statSync } from 'fs';
import path from 'path';
import { requireSuccess } from '../../../test/result';
import { getTempfiles, getTempPackage } from '../../../test/tempfile';
import { MediaFileService } from '../media-file.service';

const EXAMPLE_FILES = [
  { fileType: 'png', exampleFile: 'file_example_PNG_500kB.png' },
  { fileType: 'jpeg', exampleFile: 'file_example_JPG_100kB.jpg' },
  { fileType: 'tiff', exampleFile: 'file_example_TIFF_1MB.tiff' }
];

describe(MediaFileService, () => {
  for (const { fileType, exampleFile } of EXAMPLE_FILES) {
    it(`putFile() accepts ${fileType} files, copies them into storage and generates renditions for them`, async () => {
      jest.setTimeout(15000);

      const { archive, service, ...fixture } = await setup();
      const sourceFile = fixture.validSourceFile(exampleFile);

      // Blob stored in archive is same as the source file
      const mediaFile = requireSuccess(
        await service.putFile(archive, sourceFile)
      );
      const blobPath = service.getMediaPath(archive, mediaFile);
      expect(statSync(sourceFile).size).toEqual(statSync(blobPath).size);

      // Record is retreivable
      expect(await service.getFile(archive, mediaFile.id)).toBeDefined();

      // Rendition URI is created and resolvable
      const renditionPath = MediaFileService.resolveRenditionUri(
        archive,
        service.getRenditionUri(archive, mediaFile)
      );
      expect(existsSync(renditionPath)).toBeTruthy();
    });
  }

  it('deletes blobs and renditions when deleted from archive', async () => {
    const { archive, service, ...fixture } = await setup();

    const mediaFile = requireSuccess(
      await service.putFile(archive, fixture.validSourceFile())
    );
    const blobPath = service.getMediaPath(archive, mediaFile);

    const renditionPath = MediaFileService.resolveRenditionUri(
      archive,
      service.getRenditionUri(archive, mediaFile)
    );

    await service.deleteFiles(archive, [mediaFile.id]);

    // File and renditions are deleted
    expect(existsSync(blobPath)).toBeFalsy();
    expect(existsSync(renditionPath)).toBeFalsy();

    // Record is retreivable
    expect(await service.getFile(archive, mediaFile.id)).toBeFalsy();
  });
});

async function setup() {
  const tmp = await getTempfiles();
  const archive = await getTempPackage(tmp());
  const service = new MediaFileService();

  return {
    archive,
    service,
    validSourceFile: (filename = EXAMPLE_FILES[0].exampleFile) => {
      return path.join(__dirname, 'examples', filename);
    }
  };
}

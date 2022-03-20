import { ArchivePackage } from '../package/archive-package';

export class AssetService {
  constructor(private archive: ArchivePackage) {}

  all() {
    return this.archive.useDb((db) => {
      return db.getRepository;
    });
  }
}

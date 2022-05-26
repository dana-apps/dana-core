import { useMemo } from 'react';
import { MediaTypes } from '../../../app/media/media-types';
import {
  AddAssetMedia,
  RemoveAssetMedia
} from '../../../common/asset.interfaces';
import { ShowFilePickerModal } from '../../../common/ui.interfaces';
import { createFileFilter } from '../../../common/util/file';
import { useRPC } from '../../ipc/ipc.hooks';
import { useErrorDisplay } from './error.hooks';
import { useModal } from './window.hooks';

const MediaFileFilters = MediaTypes.map((type) =>
  createFileFilter(type.name, type.extensions)
);

const AllFilters = [
  createFileFilter(
    'All Media',
    MediaTypes.map((f) => f.extensions[0])
  ),
  ...MediaFileFilters
];

export function useMediaFiles() {
  const rpc = useRPC();
  const error = useErrorDisplay();
  const modal = useModal();

  return useMemo(
    () => ({
      addFile: async (assetId: string) => {
        const files = error.guard(
          await rpc(ShowFilePickerModal, {
            title: 'Add media',
            message: 'Select a media file to add',
            filters: AllFilters,
            confirmButtonLabel: 'Add'
          })
        );

        if (!files) {
          return;
        }

        for (const file of files) {
          error.guard(
            await rpc(AddAssetMedia, { assetId, mediaFilePath: file })
          );
        }
      },
      removeFile: async (assetId: string, mediaId: string) => {
        const confirmed = await modal.confirm({
          title: 'Delete media',
          message:
            'Are you sure you want to delete this file? This operation cannot be undone.',
          icon: 'question'
        });

        if (confirmed) {
          error.guard(
            await rpc(RemoveAssetMedia, {
              assetId,
              mediaId
            })
          );
        }
      }
    }),
    [error, modal, rpc]
  );
}

import { compact } from 'lodash';
import React, { FC, useState } from 'react';
import { DropzoneOptions, useDropzone } from 'react-dropzone';
import { Box, BoxProps } from 'theme-ui';

interface DropzoneProps extends BoxProps {
  onAcceptFiles: (items: FileSystemEntry[]) => void;
  dropzoneOptions?: Omit<
    DropzoneOptions,
    | 'onDrop'
    | 'onDragEnter'
    | 'onDragLeave'
    | 'onDropAccepted'
    | 'useFsAccessApi'
  >;
}

export const Dropzone: FC<DropzoneProps> = ({
  onAcceptFiles,
  children,
  dropzoneOptions,
  ...props
}) => {
  const [over, setOver] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    noClick: true,
    ...dropzoneOptions,
    useFsAccessApi: true,

    onDropAccepted: (_, event) => {
      if ('dataTransfer' in event) {
        const { dataTransfer } = event as { dataTransfer: DataTransfer };
        const entries = compact(
          Array.from(dataTransfer.items).map((x) => x.webkitGetAsEntry())
        );

        if (entries.length > 0) {
          onAcceptFiles(entries);
        }
      }
    },
    onDrop: () => {
      setOver(false);
    },
    onDragEnter: () => setOver(true),
    onDragLeave: () => setOver(false)
  });

  return (
    <Box sx={{ position: 'relative' }} {...getRootProps()} {...props}>
      <input {...getInputProps()} />
      {children}

      {over && (
        <Box
          sx={{
            left: 0,
            top: 0,
            position: 'absolute',
            width: '100%',
            height: '100%',
            border: '5px solid var(--theme-ui-colors-accent)'
          }}
        />
      )}
    </Box>
  );
};

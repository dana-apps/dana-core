/** @jsxImportSource theme-ui */

import { FC, useState } from 'react';
import { DropzoneOptions, useDropzone } from 'react-dropzone';
import { Box, BoxProps } from 'theme-ui';

interface DropzoneProps extends BoxProps {
  onAcceptFiles: (items: File[]) => void;
  dropzoneOptions?: Omit<
    DropzoneOptions,
    'onDrop' | 'onDragEnter' | 'onDragLeave' | 'onDropAccepted'
  >;
}

/**
 * Dropzone with themed drop-target affordances.
 */
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

    onDropAccepted: (files) => {
      onAcceptFiles(files);
      setOver(false);
    },
    onDragOver: (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
      }
      e.preventDefault();
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

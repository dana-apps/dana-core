import { FC, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, BoxOwnProps, BoxProps } from 'theme-ui';

interface DropzoneProps extends BoxProps {
  onDropFile: <T extends File>(acceptedFiles: T[]) => void;
}

export const Dropzone: FC<DropzoneProps> = ({
  onDropFile,
  children,
  ...props
}) => {
  const [over, setOver] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    noClick: true,
    onDrop: (files) => {
      setOver(false);
      onDropFile(files);
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

/** @jsxImportSource theme-ui */

import { FC } from 'react';
import {
  Check,
  ExclamationTriangle,
  ExclamationTriangleFill
} from 'react-bootstrap-icons';
import { BoxProps, Donut } from 'theme-ui';

interface LoadingCellProps {
  error?: string;
  progress?: number;
  size?: number;
}

export const LoadingCell: FC<LoadingCellProps> = ({
  error,
  progress,
  size = 18,
  ...props
}) => {
  if (progress && progress < 1) {
    return (
      <Donut {...props} size={size} strokeWidth={6} value={progress ?? 1} />
    );
  }

  if (progress && progress >= 1) {
    return (
      <Check
        sx={{
          backgroundColor: 'success',
          borderRadius: size
        }}
        color="white"
        size={size}
      />
    );
  }

  if (error) {
    return (
      <ExclamationTriangleFill
        color="var(--theme-ui-colors-error)"
        size={size}
      />
    );
  }

  return null;
};

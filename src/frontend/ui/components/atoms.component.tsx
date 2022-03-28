/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { Icon, Check, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { Button, Donut, IconButton, IconButtonProps, Spinner } from 'theme-ui';

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
  if (progress && progress < 0) {
    return <Spinner {...props} size={size} strokeWidth={6} />;
  }

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

interface ToolbarButtonProps extends IconButtonProps {
  icon: Icon;
  label: string;
}

export const ToolbarButton: FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  ...props
}) => (
  <Button
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      bg: 'transparent',
      color: 'inherit',
      outline: 'none'
    }}
    variant="icon"
    {...props}
  >
    <Icon size={32} sx={{ pb: 1 }} />
    <span sx={{ fontSize: 0, fontWeight: 500 }}>{label}</span>
  </Button>
);

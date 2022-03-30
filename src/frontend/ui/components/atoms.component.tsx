/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { Icon, Check, ExclamationTriangleFill } from 'react-bootstrap-icons';
import { Button, Donut, IconButtonProps, Spinner } from 'theme-ui';

interface LoadingCellProps {
  /** Represents progress to display */
  value?: ProgressValue;

  /** Size in pixels */
  size?: number;
}

/**
 * - Undefined to hide
 * - Value < 1 for indeterminate state
 * - Value between 0-1 for percent progress
 * - Value >= 1 for completion
 */
export type ProgressValue = number | 'error' | undefined;

/**
 * Represents the loading progress of an indivudal item.
 *
 * This is for representing the progress of an operation affecting a single object
 * (for example, as a cell in a in list view, rather than when a page is loading)
 */
export const ProgressIndicator: FC<LoadingCellProps> = ({
  value,
  size = 18,
  ...props
}) => {
  if (value === 'error') {
    return (
      <ExclamationTriangleFill
        color="var(--theme-ui-colors-error)"
        size={size}
      />
    );
  }

  if (value === undefined) {
    return null;
  }

  if (value < 0) {
    return <Spinner {...props} size={size} strokeWidth={6} />;
  }

  if (value < 1) {
    return <Donut {...props} size={size} strokeWidth={6} value={value} />;
  }

  if (value >= 1) {
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

  return null;
};

interface ToolbarButtonProps extends IconButtonProps {
  /** Toolbar icon */
  icon: Icon;

  /** Toolbar label */
  label: string;
}

/**
 * Represent a button in a window's top-level toolbar
 */
export const ToolbarButton: FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  ...props
}) => (
  <Button
    sx={{
      variant: 'icon',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      bg: 'transparent',
      color: 'black',
      outline: 'none'
    }}
    {...props}
  >
    <Icon size={32} sx={{ pb: 1 }} />
    <span sx={{ fontSize: 0, fontWeight: 500 }}>{label}</span>
  </Button>
);

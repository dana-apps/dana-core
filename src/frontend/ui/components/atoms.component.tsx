/** @jsxImportSource theme-ui */

import { Children, cloneElement, FC, ReactElement, useState } from 'react';
import { Icon, Check, ExclamationTriangleFill } from 'react-bootstrap-icons';
import {
  BoxProps,
  Button,
  Donut,
  Flex,
  IconButton,
  IconButtonProps,
  Spinner,
  useThemeUI
} from 'theme-ui';

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
export type ProgressValue = number | 'error' | 'warning' | undefined;

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

  if (value === 'warning') {
    return (
      <ExclamationTriangleFill
        color="var(--theme-ui-colors-warn)"
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

  /** Link to route */
  path?: string;
}

/**
 * Represent a button in a window's top-level toolbar
 */
export const ToolbarButton: FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  ...props
}) => {
  return (
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
};

interface TabBarButtonProps extends IconButtonProps {
  /** Icon */
  icon: Icon;

  /** Button label */
  label: string;

  /** Is the view active? */
  active?: boolean;
}

/**
 * Represent a button in a tab bar
 */
export const TabBarButton: FC<TabBarButtonProps> = ({
  icon: Icon,
  label,
  active,
  ...props
}) => {
  const { theme } = useThemeUI();
  return (
    <IconButton
      aria-label={label}
      aria-selected={active}
      sx={{
        bg: active ? 'primary' : undefined,
        borderRadius: 0
      }}
      {...props}
    >
      <Icon
        color={String(theme.colors?.[active ? 'primaryContrast' : 'text'])}
      />
    </IconButton>
  );
};

interface TabBarProps extends BoxProps {
  children?: ReactElement<TabBarButtonProps>[];

  /** Initial tab to display. Defaults to first child. */
  tabId: string | undefined;

  /** If false, disable all the buttons except the active one. Defaults to true */
  onTabChange: (x: string) => void;
}

export const TabBar: FC<TabBarProps> = ({
  children = [],
  tabId = children[0]?.props.label,
  onTabChange,
  ...props
}) => {
  return (
    <>
      <Flex sx={{ flexDirection: 'row', borderBottom: 'primary' }} {...props}>
        {Children.map(children, (child: ReactElement<TabBarButtonProps>) =>
          cloneElement(child, {
            active: child.props.label === tabId,
            onClick: () => onTabChange(child.props.label)
          })
        )}
      </Flex>

      {children.find((child) => child.props.label === tabId)?.props.children}
    </>
  );
};

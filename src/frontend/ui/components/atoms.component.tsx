/** @jsxImportSource theme-ui */

import { Children, cloneElement, FC, ReactElement } from 'react';
import { Icon, Check, ExclamationTriangleFill } from 'react-bootstrap-icons';
import {
  BoxProps,
  Button,
  Donut,
  Flex,
  IconButton,
  IconButtonProps,
  Spinner
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

interface TabsProps extends BoxProps {
  children?: ReactElement<IconTab>[];

  /** Label of the tab to display. If not provided, defaults to the first tab. */
  currentTab: string | undefined;

  /** If false, disable all the buttons except the active one. Defaults to true */
  onTabChange: (x: string) => void;
}

/**
 * A mini-router and Tab bar component suitable for for tab displays in contextual side panels.
 *
 * Displays the children of the active tab (identified by its `label` attribute) and sets its `active`
 * property to true.
 *
 * The parent is responsible for controlling the state by passing in `currentTab` and handling `onTabChange()`
 */
export const Tabs: FC<TabsProps> = ({
  children = [],
  currentTab: tabId = children[0]?.props.label,
  onTabChange,
  ...props
}) => {
  return (
    <>
      <Flex sx={{ flexDirection: 'row', borderBottom: 'primary' }} {...props}>
        {Children.map(children, (child: ReactElement<IconTab>) =>
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

interface IconTab extends IconButtonProps {
  /** Icon to render */
  icon: Icon;

  /** Accessibility / tooltip label */
  label: string;

  /** Render the tab button in active state if true */
  active?: boolean;
}

/**
 * A tab button suitable for use with `Tabs` that renders a small icon, along with an accessibility label and tooltip.
 */
export const IconTab: FC<IconTab> = ({
  icon: Icon,
  label,
  active,
  ...props
}) => {
  return (
    <IconButton
      aria-label={label}
      aria-selected={active}
      title={label}
      sx={{
        bg: active ? 'primary' : undefined,
        borderRadius: 0
      }}
      {...props}
    >
      <Icon
        color={
          active
            ? 'var(--theme-ui-colors-primaryContrast)'
            : 'var(--theme-ui-colors-text)'
        }
      />
    </IconButton>
  );
};

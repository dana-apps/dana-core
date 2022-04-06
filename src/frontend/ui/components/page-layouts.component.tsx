/** @jsxImportSource theme-ui */

import 'react-reflex/styles.css';

import { FC, ReactElement, ReactNode } from 'react';
import { Box, BoxProps, Flex, Heading } from 'theme-ui';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import { NavLink } from 'react-router-dom';

interface NavListSectionProps {
  /** Section header presented to user */
  title: string;
}

/**
 * Headed section in a top-level navigation list.
 */
export const NavListSection: FC<NavListSectionProps> = ({
  title,
  children,
  ...props
}) => (
  <Box sx={{ pb: 3 }} {...props}>
    <Heading sx={{ p: 1, px: 2 }} variant="section" as="h3">
      {title}
    </Heading>

    {children}
  </Box>
);

interface NavListItemProps {
  /** Label presented to user */
  title: string;

  /** Path navigated to on click */
  path: string;
}

/**
 * Link item in a top-level navigation list. Renders active state.
 */
export const NavListItem: FC<NavListItemProps> = ({
  path,
  title: label,
  ...props
}) => (
  <NavLink
    sx={{ color: 'inherit', textDecoration: 'inherit' }}
    to={path}
    {...props}
  >
    {({ isActive }) => (
      <Box
        sx={{
          bg: isActive ? 'highlight' : undefined,
          p: 1,
          px: 2,
          fontSize: 1,
          marginTop: '1px',
          color: isActive ? 'highlightContrast' : undefined,
          '&:hover': {
            bg: isActive ? undefined : 'highlightHint'
          }
        }}
        {...props}
      >
        {label}
      </Box>
    )}
  </NavLink>
);

export interface ArchiveWindowLayoutProps {
  /** Top-level navigation view */
  sidebar?: ReactElement;

  /** Buttons associated with top-level navigation view */
  sidebarButtons?: ReactElement;

  /** Main screen content */
  main?: ReactElement;
}

/**
 * Top-level layout for archive windows.
 */
export const ArchiveWindowLayout: FC<ArchiveWindowLayoutProps> = ({
  sidebar,
  sidebarButtons,
  main
}) => {
  return (
    <ReflexContainer
      sx={{
        '&.reflex-container.vertical > .reflex-splitter': {
          borderRight: '1px solid var(--theme-ui-colors-border)',
          borderLeft: 'none',
          width: '1px'
        },
        '> .reflex-element': {
          overflow: 'hidden'
        }
      }}
      windowResizeAware
      orientation="vertical"
    >
      <ReflexElement
        sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
        flex={0.25}
        minSize={100}
        maxSize={300}
      >
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {sidebar}
        </Box>

        {sidebarButtons && (
          <Box
            sx={{
              p: 0,
              pt: 1,
              flexShrink: 0,
              borderTop: '1px solid var(--theme-ui-colors-border)',
              color: 'muted'
            }}
          >
            {sidebarButtons}
          </Box>
        )}
      </ReflexElement>

      <ReflexSplitter propagate={true} />

      <ReflexElement minSize={320}>{main}</ReflexElement>
    </ReflexContainer>
  );
};

interface BottomBarProps extends BoxProps {
  /** 'Action buttons' for top-level screen actions ("Save changes", "Cancel", etc) */
  actions?: ReactNode;
}

/**
 *  Status/action bar displayed at the bottom of a screen.
 */
export const BottomBar: FC<BottomBarProps> = ({
  actions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  children,
  ...props
}) => (
  <Flex
    sx={{
      padding: 4,
      bg: 'gray1',
      borderTop: 'primary',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'baseline',
      '> *:not(:last-of-type)': {
        mr: 6
      }
    }}
    {...props}
  >
    {actions}
  </Flex>
);

/**
 * Render a resizable horizontally split layout suitable for presenting a main 'list' area and a 'detail' area when
 * an item is selected in the main area.
 *
 * This layout is sometimes refered to as a 'master-detail view'.
 */
export const PrimaryDetailLayout: FC<
  Omit<BoxProps, 'ref'> & { detail?: ReactNode }
> = ({ detail, children, ...props }) => {
  return (
    <ReflexContainer
      sx={{
        '&.reflex-container.vertical > .reflex-splitter': {
          borderRight: '1px solid var(--theme-ui-colors-border)',
          borderLeft: 'none',
          width: '1px'
        },
        '> .reflex-element': {
          overflow: 'hidden'
        }
      }}
      windowResizeAware
      orientation="vertical"
      {...props}
    >
      <ReflexElement minSize={320}>{children}</ReflexElement>

      {detail && <ReflexSplitter propagate={true} />}

      {detail && (
        <ReflexElement
          sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
          flex={0.25}
          minSize={100}
        >
          <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {detail}
          </Box>
        </ReflexElement>
      )}
    </ReflexContainer>
  );
};

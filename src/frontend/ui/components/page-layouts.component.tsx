/** @jsxImportSource theme-ui */

import { FC, ReactElement } from 'react';
import { Box, Heading } from 'theme-ui';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';

import 'react-reflex/styles.css';
import { WindowInset } from '../window';

export const ListSection: FC<{ label: string }> = ({
  label,
  children,
  ...props
}) => (
  <Box sx={{ pb: 3 }} {...props}>
    <Heading sx={{ p: 1, px: 2 }} variant="section" as="h3">
      {label}
    </Heading>

    {children}
  </Box>
);

export const ListItem: FC<{ label: string; active?: boolean }> = ({
  active,
  label,
  ...props
}) => (
  <Box
    sx={{
      bg: active ? 'highlight' : undefined,
      p: 1,
      px: 2,
      fontSize: 1,
      marginTop: '1px',
      color: active ? 'highlightContrast' : undefined,
      '&:hover': {
        bg: active ? undefined : 'highlightHint'
      }
    }}
    {...props}
  >
    {label}
  </Box>
);

export interface ScreenLayoutProps {
  sidebar?: ReactElement;
  sidebarButtons?: ReactElement;
  main?: ReactElement;
}

export const ScreenLayout: FC<ScreenLayoutProps> = ({
  sidebar,
  sidebarButtons,
  main
}) => {
  return (
    <ReflexContainer
      sx={{
        '&.reflex-container.vertical > .reflex-splitter': {
          borderRight: '1px solid var(--theme-ui-colors-border)',
          borderLeft: 'none'
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

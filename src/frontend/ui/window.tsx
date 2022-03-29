/** @jsxImportSource theme-ui */

import { FC, HTMLAttributes } from 'react';
import { X } from 'react-bootstrap-icons';
import { IconButton } from 'theme-ui';
import { useFrontendConfig } from '../config';

const TITLEBAR_HEIGHT = '32px';

/**
 * Window wrapper chrome. Suitable for rendering a frameless window in an electron app.
 */
export const Window: FC<HTMLAttributes<unknown>> = ({ children, ...props }) => {
  const { platform } = useFrontendConfig();

  return (
    <div
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',

        userSelect: 'none',
        WebkitAppRegion: 'drag',
        '> *': { WebkitAppRegion: 'no-drag' },

        bg: 'background',
        transition: 'background-color 0.2s ease-in-out',

        scrollbarColor: 'foreground',
        scrollbarWidth: 'thin',
        '&::WebkitScrollbar': {
          width: '5px',
          height: '5px'
        },
        '&::WebkitScrollbarTrack': {
          bg: 'background'
        },
        '&::WebkitScrollbarThumb': {
          bg: 'foreground',
          borderRadius: 0
        }
      }}
      {...props}
    >
      {children}

      {/* Linux can't render window chrome in frameless mode, so do it here instead */}
      {platform === 'linuxish' && (
        <div
          sx={{
            height: TITLEBAR_HEIGHT,
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 100
          }}
        >
          <IconButton onClick={() => window.close()}>
            <X fontSize={18} />
          </IconButton>
        </div>
      )}
    </div>
  );
};

/** Inset window content to ensure it isn't obscured by window chrome on platforms where the chome is added on top  */
export const WindowInset: FC<HTMLAttributes<unknown>> = (props) => (
  <div
    sx={{
      height: TITLEBAR_HEIGHT,
      WebkitAppRegion: 'drag',
      '> *': { WebkitAppRegion: 'no-drag' }
    }}
    {...props}
  />
);

export const WindowDragArea: FC<HTMLAttributes<unknown>> = (props) => (
  <div
    sx={{
      WebkitAppRegion: 'drag',
      '> *': { WebkitAppRegion: 'no-drag' }
    }}
    {...props}
  />
);

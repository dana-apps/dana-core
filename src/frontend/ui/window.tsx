/** @jsxImportSource theme-ui */

import { FC, HTMLAttributes } from 'react';
import { X } from 'react-bootstrap-icons';
import { IconButton } from 'theme-ui';
import { useFrontendConfig } from '../config';

const TITLEBAR_HEIGHT = '36px';

export const Window: FC<HTMLAttributes<unknown>> = ({ children, ...props }) => {
  const { platform } = useFrontendConfig();

  return (
    <div
      className="drag-region"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',

        userSelect: 'none',
        WebkitAppRegion: 'drag',
        '> *': {
          WebkitAppRegion: 'no-drag'
        },

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
      {/* Linux can't render window chrome in frameless mode, so do it here instead */}
      {platform === 'linuxish' && (
        <div
          sx={{
            height: TITLEBAR_HEIGHT,
            position: 'absolute',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
          <IconButton onClick={() => window.close()}>
            <X fontSize={18} />
          </IconButton>
        </div>
      )}

      {children}
    </div>
  );
};

/** Inset window content to ensure it isn't obscured by chrome  */
export const WindowInset = () => <div sx={{ height: TITLEBAR_HEIGHT }} />;

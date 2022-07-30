/** @jsxImportSource theme-ui */

import { FC, HTMLAttributes, useCallback, useEffect, useState } from 'react';
import { ThreeDots } from 'react-bootstrap-icons';
import { BoxProps, Button, Flex, Text } from 'theme-ui';
import { FrontendPlatform } from '../../common/frontend-config';
import {
  MaximizationState,
  MaximizationStateChanged,
  ToggleMaximizeWindow,
  MinimizeWindow,
  GetMaximizationState
} from '../../common/ui.interfaces';
import { useFrontendConfig } from '../config';
import { useEvent, useRPC } from '../ipc/ipc.hooks';

const TITLEBAR_HEIGHT = '32px';

const WindowsIcons = import.meta.globEager('./icons/windows/*.png');

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
        overflow: 'hidden',
        border:
          platform === 'windows' || platform === 'linuxish'
            ? '1px solid var(--theme-ui-colors-border)'
            : 'none',

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

      {/* Windows & linux don't render window chrome in frameless mode, so do it here instead */}
      {(platform === 'linuxish' || platform === 'windows') && (
        <WindowControls />
      )}
    </div>
  );
};

/** Inset window content to ensure it isn't obscured by window chrome on platforms where the chome is added on top  */
export const WindowInset: FC<
  HTMLAttributes<unknown> & { platforms?: FrontendPlatform[] }
> = ({ platforms, ...props }) => {
  const { platform } = useFrontendConfig();
  if (platforms && !platforms.includes(platform)) {
    return null;
  }

  return (
    <div
      sx={{
        height: TITLEBAR_HEIGHT,
        WebkitAppRegion: 'drag',
        '> *': { WebkitAppRegion: 'no-drag' }
      }}
      {...props}
    />
  );
};

export const WindowDragArea: FC<HTMLAttributes<unknown>> = (props) => (
  <div
    sx={{
      WebkitAppRegion: 'drag',
      '> *': { WebkitAppRegion: 'no-drag' }
    }}
    {...props}
  />
);

const WindowControls = () => {
  const config = useFrontendConfig();
  const rpc = useRPC();
  const [state, setState] = useState<MaximizationState>();

  useEvent(MaximizationStateChanged, async (state) => {
    setState(state);
  });

  useEffect(() => {
    rpc(GetMaximizationState, {}).then((res) => {
      if (res.status === 'ok') {
        setState(res.value);
      } else {
        setState('normal');
      }
    });
  }, [rpc]);

  const minimize = useCallback(() => rpc(MinimizeWindow, {}), [rpc]);
  const toggleMaximize = useCallback(
    () => rpc(ToggleMaximizeWindow, {}),
    [rpc]
  );

  if (config.type === 'modal') {
    return null;
  }

  if (!state) {
    return null;
  }

  return (
    <div
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 46px)',
        position: 'absolute',
        top: 0,
        right: 0,
        height: '32px',
        filter: 'invert(100%)',
        '> *': {
          gridRow: '1 / span 1',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          '&:hover': {
            opacity: 0.5
          }
        }
      }}
    >
      {config.type === 'archive' && (
        <>
          <div role="button" onClick={minimize}>
            <img
              srcSet={`${windowsIcon(
                './icons/windows/min-w-10.png'
              )} 1x, ${windowsIcon(
                './icons/windows/min-w-12.png'
              )} 1.25x, ${windowsIcon(
                './icons/windows/min-w-15.png'
              )} 1.5x, ${windowsIcon(
                './icons/windows/min-w-15.png'
              )} 1.75x, ${windowsIcon(
                './icons/windows/min-w-20.png'
              )} 2x, ${windowsIcon(
                './icons/windows/min-w-20.png'
              )} 2.25x, ${windowsIcon(
                './icons/windows/min-w-24.png'
              )} 2.5x, ${windowsIcon(
                './icons/windows/min-w-30.png'
              )} 3x, ${windowsIcon('./icons/windows/min-w-30.png')} 3.5x`}
              draggable="false"
            />
          </div>

          {state !== 'maximized' && (
            <div role="button" onClick={toggleMaximize}>
              <img
                srcSet={`${windowsIcon(
                  './icons/windows/max-w-10.png'
                )} 1x, ${windowsIcon(
                  './icons/windows/max-w-12.png'
                )} 1.25x, ${windowsIcon(
                  './icons/windows/max-w-15.png'
                )} 1.5x, ${windowsIcon(
                  './icons/windows/max-w-15.png'
                )} 1.75x, ${windowsIcon(
                  './icons/windows/max-w-20.png'
                )} 2x, ${windowsIcon(
                  './icons/windows/max-w-20.png'
                )} 2.25x, ${windowsIcon(
                  './icons/windows/max-w-24.png'
                )} 2.5x, ${windowsIcon(
                  './icons/windows/max-w-30.png'
                )} 3x, ${windowsIcon('./icons/windows/max-w-30.png')} 3.5x`}
                draggable="false"
              />
            </div>
          )}

          {state === 'maximized' && (
            <div role="button" onClick={toggleMaximize}>
              <img
                srcSet={`${windowsIcon(
                  './icons/windows/restore-w-10.png'
                )} 1x, ${windowsIcon(
                  './icons/windows/restore-w-12.png'
                )} 1.25x, ${windowsIcon(
                  './icons/windows/restore-w-15.png'
                )} 1.5x, ${windowsIcon(
                  './icons/windows/restore-w-15.png'
                )} 1.75x, ${windowsIcon(
                  './icons/windows/restore-w-20.png'
                )} 2x, ${windowsIcon(
                  './icons/windows/restore-w-20.png'
                )} 2.25x, ${windowsIcon(
                  './icons/windows/restore-w-24.png'
                )} 2.5x, ${windowsIcon(
                  './icons/windows/restore-w-30.png'
                )} 3x, ${windowsIcon('./icons/windows/restore-w-30.png')} 3.5x`}
                draggable="false"
              />
            </div>
          )}
        </>
      )}

      <div role="button" onClick={window.close}>
        <img
          srcSet={`${windowsIcon(
            './icons/windows/close-w-10.png'
          )} 1x, ${windowsIcon(
            './icons/windows/close-w-12.png'
          )} 1.25x, ${windowsIcon(
            './icons/windows/close-w-15.png'
          )} 1.5x, ${windowsIcon(
            './icons/windows/close-w-15.png'
          )} 1.75x, ${windowsIcon(
            './icons/windows/close-w-20.png'
          )} 2x, ${windowsIcon(
            './icons/windows/close-w-20.png'
          )} 2.25x, ${windowsIcon(
            './icons/windows/close-w-24.png'
          )} 2.5x, ${windowsIcon(
            './icons/windows/close-w-30.png'
          )} 3x, ${windowsIcon('./icons/windows/close-w-30.png')} 3.5x`}
          draggable="false"
        />
      </div>
    </div>
  );
};

export const WindowTitle: FC<{ showVersion?: boolean } & BoxProps> = ({
  showVersion,
  children,
  ...props
}) => {
  const { title, version, releaseDate } = useFrontendConfig();
  return (
    <WindowDragArea
      sx={{
        py: 5,
        px: 4,
        bg: 'offWhite',
        position: 'relative'
      }}
      {...props}
    >
      <Flex sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          sx={{
            fontWeight: 800,
            fontFamily: 'body',
            fontSize: '18px',
            lineHeight: '25px'
          }}
        >
          {children || title}
        </Text>
        {/* <Button
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingX: '13px',
            paddingY: '13px',
            width: '93px'
          }}
        >
          <ThreeDots /> Options
        </Button> */}
      </Flex>

      {showVersion && (
        <Text
          sx={{
            bottom: 0,
            color: '#818388',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: ' 14px',
            p: 1,
            position: 'absolute',
            px: 3,
            right: 0,
            textAlign: 'right'
          }}
        >
          v{version} ({releaseDate.replace(/T\d\d.*/, '')})
        </Text>
      )}
    </WindowDragArea>
  );
};

function windowsIcon(key: string) {
  return WindowsIcons[key].default;
}

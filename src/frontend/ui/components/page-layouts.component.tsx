/** @jsxImportSource theme-ui */

import 'react-reflex/styles.css';

import {
  FC,
  FocusEvent,
  FormEvent,
  forwardRef,
  ReactElement,
  ReactNode,
  useCallback,
  useRef,
  useState
} from 'react';
import { Box, BoxProps, Flex, Heading } from 'theme-ui';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ContextMenuItem,
  ContextSeparator,
  useContextMenu
} from '../hooks/menu.hooks';
import { useOnClickOutside } from '../hooks/mouse.hooks';
import { DropTargetChildProps } from './dnd.component';
import { useMergedRefs } from '../hooks/state.hooks';

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
  <Box sx={{ pb: 5 }} {...props}>
    <Heading sx={{ p: 2, px: 3 }} variant="section" as="h3">
      {title}
    </Heading>

    {children}
  </Box>
);

export interface NavListItemProps extends DropTargetChildProps {
  /** Label presented to user */
  title: string;

  /** Path navigated to on click */
  path: string;

  /** Status indicator shown on the item */
  status?: ReactNode;

  /** Start the item in editing mode */
  defaultEditing?: boolean;

  /** If provided, allows the item to be renamed via the context menu */
  onRename?: (name: string) => Promise<void> | void;

  /** If provided, allows the item to be deleted via the context menu */
  onDelete?: () => Promise<void>;

  contextMenuItems?: ContextMenuItem[];
}

/**
 * Link item in a top-level navigation list. Renders active state.
 */
export const NavListItem: FC<NavListItemProps> = forwardRef(
  (
    {
      path,
      title: label,
      defaultEditing = false,
      onRename,
      onDelete,
      status,
      contextMenuItems = [],
      dropAccepted,
      ...props
    },
    ref
  ) => {
    const isActive = useLocation().pathname === path;
    const [editing, setEditing] = useState(defaultEditing);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const contextMenu = useContextMenu({
      options: [
        onRename && {
          id: 'rename',
          label: 'Rename',
          action: () => {
            setEditing(true);
          }
        },
        onDelete && {
          id: 'delete',
          label: 'Delete',
          action: onDelete
        },
        ...(contextMenuItems.length > 0
          ? [ContextSeparator, ...contextMenuItems]
          : [])
      ]
    });

    const finishEditing = useCallback(
      async (el: HTMLInputElement) => {
        if (el && onRename && el.value.trim() && el.value.trim() !== label) {
          await onRename(el.value);

          // Ugly hack: Prevent old value from flickering back in
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        setEditing(false);
      },
      [label, onRename]
    );

    const handleSubmit = useCallback(
      async (event: FormEvent<HTMLElement>) => {
        event.preventDefault();
        const el = event.currentTarget.querySelector<HTMLInputElement>(
          'input[name="value"]'
        );

        if (el) {
          finishEditing(el);
        }
      },
      [finishEditing]
    );

    const handleBlur = useCallback(
      async (event: FocusEvent<HTMLInputElement>) => {
        finishEditing(event.currentTarget);
      },
      [finishEditing]
    );

    useOnClickOutside(wrapperRef, () => {
      if (editing && wrapperRef.current) {
        const input = wrapperRef.current.querySelector<HTMLInputElement>(
          'input[name="value"]'
        );
        if (input) {
          finishEditing(input);
        }
      }
    });

    const refs = useMergedRefs(ref, wrapperRef);

    const content = (
      <Flex
        {...contextMenu.triggerProps}
        ref={refs}
        tabIndex={0}
        sx={{
          variant:
            (!isActive && (editing || contextMenu.visible)) || dropAccepted
              ? 'listItems.active'
              : undefined,
          flexDirection: 'row',
          alignItems: 'center',
          bg: isActive ? 'highlight' : undefined,
          p: 2,
          px: 3,
          fontSize: 1,
          marginTop: '1px',
          color: isActive ? 'highlightContrast' : undefined,
          '&:hover': {
            bg: isActive ? undefined : 'highlightHint'
          }
        }}
        {...props}
      >
        {!editing && (
          <span tabIndex={-1} sx={{ flex: 1 }}>
            {label}
          </span>
        )}

        {editing && (
          <form onSubmit={handleSubmit}>
            <input
              ref={focusOnMount}
              onBlur={handleBlur}
              name="value"
              sx={{
                flex: 1,
                p: 0,
                border: 'none',
                outline: 'none',
                bg: 'transparent',
                letterSpacing: 'inherit',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                fontWeight: 'inherit',
                color: isActive ? 'highlightContrast' : 'text'
              }}
              defaultValue={label}
            />
          </form>
        )}

        {status}
      </Flex>
    );

    if (editing) {
      return (
        <span sx={{ color: 'inherit', textDecoration: 'inherit' }} {...props}>
          {content}
        </span>
      );
    } else {
      return (
        <NavLink
          sx={{ color: 'inherit', textDecoration: 'inherit' }}
          to={path}
          {...props}
        >
          {content}
        </NavLink>
      );
    }
  }
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
          <Flex
            sx={{
              p: 0,
              pt: 1,
              alignItems: 'center',
              justifyContent: 'flex-start',
              flexShrink: 0,
              borderTop: '1px solid var(--theme-ui-colors-border)',
              color: 'muted',
              bg: 'gray1',
              '> *': {
                marginInlineEnd: 2
              }
            }}
          >
            {sidebarButtons}
          </Flex>
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
        minHeight: 0,
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
      <ReflexElement
        sx={{ display: 'flex', flexDirection: 'column' }}
        minSize={320}
      >
        {children}
      </ReflexElement>

      {detail && <ReflexSplitter propagate={true} />}

      {detail && (
        <ReflexElement
          sx={{
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}
          flex={0.25}
          minSize={320}
        >
          {detail}
        </ReflexElement>
      )}
    </ReflexContainer>
  );
};

const focusOnMount = (el: HTMLInputElement | null) => {
  if (el) {
    el.focus();
    el.select();
  }
};

import { Theme } from 'theme-ui';
import * as polished from 'polished';

const controlHover = {
  '&:hover:not(:disabled):not(:active):not([aria-selected="true"])': {
    opacity: 0.5
  },
  '&:disabled:not(:active):not([aria-selected="true"])': {
    opacity: 0.5
  }
};

const colors = {
  dark: '#010000',
  gray: '#D9D4D3',
  gray1: '#EDE9E9',
  gray2: '#F9F7F7',
  green: '#60D39B',
  muted: '#818B88',
  brown: '#81683E',
  charcoal: '#3C3746',
  blue: '#28108A'
};

export const theme: Theme = {
  config: {
    useCustomProperties: true,
    initialColorModeName: 'system',
    useRootStyles: true,
    useBorderBox: true,
    useLocalStorage: false
  },
  space: [0, 3, 5, 8, 13, 21, 34],
  colors: {
    ...colors,
    text: 'black',
    success: colors.green,
    error: polished.setHue(0, colors.green),
    warn: polished.setHue(26, colors.green),
    border: colors.gray,
    highlight: colors.charcoal,
    highlightHint: polished.transparentize(0.8, colors.charcoal),
    highlightContrast: 'white',
    background: colors.gray2,
    foreground: 'white',
    primary: colors.blue,
    primaryContrast: 'white',
    secondary: '#81683E',
    accent: '#008FFF',
    muted: '#818B88'
  },
  borders: {
    primary: '2px solid var(--theme-ui-colors-border)',
    selected: '2px solid var(--theme-ui-colors-accent)'
  },
  radii: {
    control: 5
  },
  shadows: {
    vertical: '0px 2px 10px 2px rgba(0,0,0,0.1)',
    medium: '0px 1px 10px 2px rgba(0,0,0,0.1)',
    raised: '1px 2px 15px 2px rgba(0,0,0,0.15)',
    selected: '0 0 0 2px var(--theme-ui-colors-accent)'
  },
  fonts: {
    body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    heading:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    monospace: 'Menlo, monospace'
  },
  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64, 72],
  fontWeights: {
    body: 400,
    heading: 400,
    display: 600
  },
  lineHeights: {
    body: 1.5,
    heading: 1.25
  },
  forms: {
    label: {
      fontSize: 1,
      fontWeight: 600
    },
    select: {
      boxSizing: 'border-box',
      margin: 0,
      minWidth: 0,
      display: 'block',
      width: '100%',
      padding: '5px',
      appearance: 'none',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      border: '1px solid',
      borderRadius: '4px',
      color: 'inherit',
      backgroundColor: 'var(--theme-ui-colors-background)'
    }
  },
  text: {
    heading: {
      fontFamily: 'heading',
      fontWeight: 'heading',
      lineHeight: 'heading'
    },
    display: {
      variant: 'text.heading',
      fontSize: [5, 6],
      fontWeight: 'display',
      letterSpacing: '-0.03em',
      mt: 3
    },
    section: {
      textTransform: 'uppercase',
      fontWeight: 700,
      fontSize: 0,
      color: 'grey',
      letterSpacing: 0.95
    }
  },
  images: {
    selectable: {
      padding: '1.5px',
      borderRadius: 3
    }
  },
  buttons: {
    primary: {
      ...controlHover,
      fontSize: 1,
      p: 3,
      px: 4,
      color: 'primaryContrast',
      backgroundColor: 'primary',
      borderRadius: 'control',
      '&:disabled': {
        bg: 'muted'
      }
    },
    icon: {
      ...controlHover
    },
    secondary: {
      ...controlHover,
      color: 'background',
      bg: 'secondary'
    },
    primaryTransparent: {
      ...controlHover,
      color: 'primary',
      backgroundColor: 'transparent'
    }
  },
  styles: {
    Container: {
      p: 3,
      maxWidth: 1024
    },
    root: {
      fontFamily: 'body',
      lineHeight: 'body',
      fontWeight: 'body'
    },
    h1: {
      variant: 'text.display'
    },
    h2: {
      variant: 'text.heading',
      fontSize: 5
    },
    h3: {
      variant: 'text.heading',
      fontSize: 4
    },
    h4: {
      variant: 'text.heading',
      fontSize: 3
    },
    h5: {
      variant: 'text.heading',
      fontSize: 2
    },
    h6: {
      variant: 'text.heading',
      fontSize: 1
    },
    a: {
      color: 'primary',
      '&:hover': {
        color: 'secondary'
      }
    },
    pre: {
      fontFamily: 'monospace',
      fontSize: 1,
      p: 3,
      color: 'text',
      bg: 'muted',
      overflow: 'auto',
      code: {
        color: 'inherit'
      }
    },
    code: {
      fontFamily: 'monospace',
      fontSize: 1
    },
    inlineCode: {
      fontFamily: 'monospace',
      color: 'secondary',
      bg: 'muted'
    },
    table: {
      width: '100%',
      my: 4,
      borderCollapse: 'separate',
      borderSpacing: 0,
      'th,td': {
        textAlign: 'left',
        py: '4px',
        pr: '4px',
        pl: 0,
        borderColor: 'muted',
        borderBottomStyle: 'solid'
      }
    },
    th: {
      verticalAlign: 'bottom',
      borderBottomWidth: '2px'
    },
    td: {
      verticalAlign: 'top',
      borderBottomWidth: '1px'
    },
    hr: {
      border: 0,
      borderBottom: '1px solid',
      borderColor: 'muted'
    }
  }
};

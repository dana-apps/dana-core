import { Theme } from 'theme-ui';

const controlHover = {
  '&:hover': {
    opacity: 0.5
  }
};

export const theme: Theme = {
  config: {
    useCustomProperties: true,
    initialColorModeName: 'system',
    useRootStyles: true,
    useBorderBox: true
  },
  colors: {
    text: 'white',
    border: 'black',
    background: '#1E1E1E',
    primary: '#429CFF',
    secondary: '#414141',
    highlight: '#0058D0',
    accent: '#008FFF',
    muted: '#2A2A2A',
    gray: '#414141',
    foreground: '#2C2C2C',
    modes: {
      dark: {
        text: '#fff',
        background: '#060606',
        primary: '#3cf',
        secondary: '#e0f',
        muted: '#191919',
        highlight: '#29112c',
        gray: '#999',
        accent: '#c0f'
      }
    }
  },
  borders: {
    primary: '2px solid var(--theme-ui-colors-border)',
    selected: '2px solid var(--theme-ui-colors-accent)'
  },
  radii: {
    control: 0
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
      color: 'text',
      backgroundColor: 'primary',
      borderRadius: 'control'
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

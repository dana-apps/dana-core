import { useState } from 'react';
import { createContainer } from 'unstated-next';

/** Context container for the current selected object */
export const SelectionContext = createContainer(() => {
  const [state, setState] = useState<string>();

  return {
    setSelection: setState,
    current: state
  };
});

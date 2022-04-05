import { useState } from 'react';
import { createContainer } from 'unstated-next';

export const SelectionContext = createContainer(() => {
  const [state, setState] = useState<string>();

  return {
    setSelection: setState,
    selection: state
  };
});

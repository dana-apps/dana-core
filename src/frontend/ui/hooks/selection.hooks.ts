import { useState } from 'react';
import { createContainer, useContainer } from 'unstated-next';

export const SelectionContext = createContainer(() => {
  const [state, setState] = useState<string>();

  return {
    setSelection: setState,
    selection: state
  };
});

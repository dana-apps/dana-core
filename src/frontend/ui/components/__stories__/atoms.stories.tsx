/** @jsxImportSource theme-ui */

import { FC, useEffect, useState } from 'react';
import { ProgressIndicator } from '../atoms.component';

export default {
  title: 'Components/Atoms'
};

export const Progress: FC = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let active = true;
    let start = 0;

    const tick: FrameRequestCallback = (time) => {
      if (active) {
        requestAnimationFrame(tick);

        if (!start) {
          start = time;
        } else {
          setProgress((time - start) / 10000);
        }
      }
    };

    requestAnimationFrame(tick);
    return () => {
      active = false;
    };
  }, []);

  return <ProgressIndicator value={progress} />;
};

export const Success = () => <ProgressIndicator value={1} />;
export const Error = () => <ProgressIndicator value="error" />;
export const Warning = () => <ProgressIndicator value="warning" />;

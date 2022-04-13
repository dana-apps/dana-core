import { cloneElement, FC, ReactElement } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Forces a component to be remounted when the page location changes.
 *
 * This is needed as react router doesn't do this by default when navigating between different param values on the same
 * route.
 *
 * This causes problems if there's some state state that we want to reset for the new page. Wrapping an element in this
 * fixes that.
 */
export const InvalidateOnPageChange: FC<{ children: ReactElement }> = ({
  children
}) => {
  const location = useLocation();
  return cloneElement(children, { key: location.pathname });
};

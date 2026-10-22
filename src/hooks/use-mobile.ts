import { onMediaQueryChange } from "@rtorcato/browser-common/mediaquery";
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    const off = onMediaQueryChange(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
      onChange,
    );
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return off;
  }, []);

  return !!isMobile;
}

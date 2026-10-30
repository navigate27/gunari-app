import * as React from "react";

export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query]
  );
  const getSnapshot = () =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : serverValue;
  return React.useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

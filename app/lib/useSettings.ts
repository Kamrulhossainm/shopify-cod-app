/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

/**
 * Local editable copy of one or more settings sections, saved as JSON to the
 * route's action (see saveSettingsFromRequest).
 */
export function useSettingsForm<T extends Record<string, any>>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const [dirty, setDirty] = useState(false);
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const shopify = useAppBridge();

  // Reset local edits whenever fresh loader data arrives (e.g. after saving).
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setState(initial);
    setDirty(false);
  }

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      // On success the loader revalidates, which resets `dirty` above.
      if (fetcher.data.ok) shopify.toast.show("Settings saved");
      else shopify.toast.show(fetcher.data.error || "Save failed", { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const update = useCallback(
    <S extends keyof T>(section: S, patch: Partial<T[S]>) => {
      setState((s) => ({ ...s, [section]: { ...s[section], ...patch } }));
      setDirty(true);
    },
    [],
  );

  const save = useCallback(() => {
    fetcher.submit({ payload: JSON.stringify(state) }, { method: "post" });
  }, [fetcher, state]);

  return { state, setState, update, save, dirty, saving: fetcher.state !== "idle" };
}

import { useSyncExternalStore } from "react";
import { load, save } from "../lib/storage";

// A small shared value saved in localStorage: every component using it re-renders when it changes.
export function persisted<T>(key: string, fallback: T) {
  let value = load<T>(key, fallback);
  const listeners = new Set<() => void>();
  const set = (v: T) => {
    value = v;
    save(key, v);
    listeners.forEach((l) => l());
  };
  const use = () =>
    useSyncExternalStore(
      (l) => (listeners.add(l), () => listeners.delete(l)),
      () => value,
    );
  return [use, set, () => value] as const; // the getter is for code outside React (the stream)
}

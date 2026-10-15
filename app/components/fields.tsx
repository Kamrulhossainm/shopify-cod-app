/**
 * Thin React wrappers around Polaris web components.
 * React 18 doesn't wire `onChange`/`onInput` props or `value` properties on
 * custom elements, so we attach native listeners and set properties via refs.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- web components are untyped in React 18 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

function useWebComponent(
  prop: "value" | "checked",
  value: unknown,
  events: string[],
  onValue: (v: any) => void,
) {
  const ref = useRef<any>(null);
  const cb = useLatest(onValue);
  useEffect(() => {
    const el = ref.current;
    if (el && el[prop] !== value) el[prop] = value;
  }, [prop, value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: Event) => cb.current((e.currentTarget as any)[prop]);
    events.forEach((ev) => el.addEventListener(ev, handler));
    return () => events.forEach((ev) => el.removeEventListener(ev, handler));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/** Drops false/null/undefined props: React 18 would render `disabled="false"`. */
export function clean<T extends Record<string, any>>(props: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(props)) if (v !== false && v != null) out[k] = v;
  return out as Partial<T>;
}

interface Base {
  label: string;
  labelAccessibilityVisibility?: "visible" | "exclusive";
  details?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

const STextField = "s-text-field" as any;
const SNumberField = "s-number-field" as any;
const STextArea = "s-text-area" as any;
const SSelect = "s-select" as any;
const SCheckbox = "s-checkbox" as any;
const SSwitch = "s-switch" as any;
const SColorField = "s-color-field" as any;
const SUrlField = "s-url-field" as any;
const SPasswordField = "s-password-field" as any;

export function TextField(
  props: Base & { value: string; onChange: (v: string) => void; prefix?: string; suffix?: string },
) {
  const { value, onChange, ...rest } = props;
  const ref = useWebComponent("value", value ?? "", ["input", "change"], (v) => onChange(String(v ?? "")));
  return <STextField ref={ref} {...clean(rest)} />;
}

export function PasswordField(props: Base & { value: string; onChange: (v: string) => void }) {
  const { value, onChange, ...rest } = props;
  const ref = useWebComponent("value", value ?? "", ["input", "change"], (v) => onChange(String(v ?? "")));
  return <SPasswordField ref={ref} {...clean(rest)} />;
}

export function UrlField(props: Base & { value: string; onChange: (v: string) => void }) {
  const { value, onChange, ...rest } = props;
  const ref = useWebComponent("value", value ?? "", ["input", "change"], (v) => onChange(String(v ?? "")));
  return <SUrlField ref={ref} {...clean(rest)} />;
}

export function TextArea(props: Base & { value: string; onChange: (v: string) => void; rows?: number }) {
  const { value, onChange, ...rest } = props;
  const ref = useWebComponent("value", value ?? "", ["input", "change"], (v) => onChange(String(v ?? "")));
  return <STextArea ref={ref} {...clean(rest)} />;
}

export function NumberField(
  props: Base & {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    prefix?: string;
    suffix?: string;
  },
) {
  const { value, onChange, ...rest } = props;
  const ref = useWebComponent("value", String(value ?? 0), ["input", "change"], (v) =>
    onChange(Number(v) || 0),
  );
  return <SNumberField ref={ref} {...clean(rest)} />;
}

export function Select<T extends string>(
  props: Base & { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] },
) {
  const { value, onChange, options, ...rest } = props;
  const ref = useWebComponent("value", value, ["change", "input"], (v) => onChange(v as T));
  return (
    <SSelect ref={ref} {...clean(rest)}>
      {options.map((o) => (
        <s-option key={o.value} value={o.value}>
          {o.label}
        </s-option>
      ))}
    </SSelect>
  );
}

export function Checkbox(props: Omit<Base, "placeholder"> & { checked: boolean; onChange: (v: boolean) => void }) {
  const { checked, onChange, ...rest } = props;
  const ref = useWebComponent("checked", !!checked, ["change", "input"], (v) => onChange(!!v));
  return <SCheckbox ref={ref} {...clean(rest)} />;
}

export function Switch(props: Omit<Base, "placeholder"> & { checked: boolean; onChange: (v: boolean) => void }) {
  const { checked, onChange, ...rest } = props;
  const ref = useWebComponent("checked", !!checked, ["change", "input"], (v) => onChange(!!v));
  return <SSwitch ref={ref} {...clean(rest)} />;
}

export function ColorField(props: Base & { value: string; onChange: (v: string) => void }) {
  const { value, onChange, ...rest } = props;
  const ref = useWebComponent("value", value, ["change", "input"], (v) => onChange(String(v)));
  return <SColorField ref={ref} {...clean(rest)} />;
}

export function Grid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <s-grid gridTemplateColumns={`repeat(${columns}, minmax(0, 1fr))`} gap="base">
      {children}
    </s-grid>
  );
}

import { Combobox } from "@base-ui/react/combobox";
import { useMemo } from "react";

export function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const items = useMemo(
    () =>
      Combobox.createItems(
        [
          { value: "", label: "All" },
          ...options.map((option) => ({ value: option, label: option })),
        ],
        { getValue: (item) => item.value, getLabel: (item) => item.label },
      ),
    [options],
  );
  return (
    <Combobox.Root items={items} value={value} onValueChange={(next) => onChange(next || "")}>
      <Combobox.Trigger
        className="filter-trigger"
        aria-label={label}
        title={value || `All ${label.toLowerCase()}`}
      >
        <span className="filter-label">{label}</span>
        <span className="filter-value">{value || "All"}</span>
        <Combobox.Icon className="filter-chevron">⌄</Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="filter-positioner" sideOffset={5} align="start">
          <Combobox.Popup className="filter-popup">
            <Combobox.Input
              className="filter-search"
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder="Type to find…"
            />
            <Combobox.Empty className="filter-empty">No matches.</Combobox.Empty>
            <Combobox.List className="filter-options">
              {(item) => (
                <Combobox.Item key={item.value} value={item.value} className="filter-option">
                  <Combobox.ItemIndicator className="filter-check">✓</Combobox.ItemIndicator>
                  <span>{item.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

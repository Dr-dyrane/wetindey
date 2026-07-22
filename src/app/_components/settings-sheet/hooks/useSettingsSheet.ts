import { haptics } from "../imports/imports";

export function useSettingsSheet() {
  const handleSegmentChange = <T extends string>(id: T, value: T, onChange: (v: T) => void) => {
    if (id !== value) {
      haptics.selection();
      onChange(id);
    }
  };

  return {
    handleSegmentChange,
  };
}

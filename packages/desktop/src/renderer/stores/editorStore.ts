import { create } from 'zustand';

export interface FileDiff {
  original: string;
  modified: string;
}

export interface FileTab {
  path: string;
  name: string;
  content: string;
  diff?: FileDiff;
}

interface EditorStore {
  tabs: FileTab[];
  activeTabIndex: number;

  openFile: (path: string, content: string) => void;
  openDiff: (path: string, original: string, modified: string) => void;
  setActiveTab: (index: number) => void;
  closeTab: (index: number) => void;
  acceptChange: (index: number) => void;
  rejectChange: (index: number) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabIndex: 0,

  openFile: (path, content) => {
    const { tabs } = get();
    const existing = tabs.findIndex((t) => t.path === path);
    const name = path.split('/').pop() || path;

    if (existing >= 0) {
      // Update existing tab
      const updated = [...tabs];
      updated[existing] = { ...updated[existing], content, diff: undefined };
      set({ tabs: updated, activeTabIndex: existing });
    } else {
      set({
        tabs: [...tabs, { path, name, content }],
        activeTabIndex: tabs.length,
      });
    }
  },

  openDiff: (path, original, modified) => {
    const { tabs } = get();
    const existing = tabs.findIndex((t) => t.path === path);
    const name = path.split('/').pop() || path;

    if (existing >= 0) {
      const updated = [...tabs];
      updated[existing] = { ...updated[existing], content: modified, diff: { original, modified } };
      set({ tabs: updated, activeTabIndex: existing });
    } else {
      set({
        tabs: [...tabs, { path, name, content: modified, diff: { original, modified } }],
        activeTabIndex: tabs.length,
      });
    }
  },

  setActiveTab: (index) => set({ activeTabIndex: index }),

  closeTab: (index) => {
    const { tabs, activeTabIndex } = get();
    const newTabs = tabs.filter((_, i) => i !== index);
    let newActive = activeTabIndex;
    if (index <= activeTabIndex && activeTabIndex > 0) {
      newActive = activeTabIndex - 1;
    }
    set({ tabs: newTabs, activeTabIndex: Math.min(newActive, newTabs.length - 1) });
  },

  acceptChange: (index) => {
    const { tabs } = get();
    if (!tabs[index]?.diff) return;
    const updated = [...tabs];
    updated[index] = {
      ...updated[index],
      content: updated[index].diff!.modified,
      diff: undefined,
    };
    set({ tabs: updated });
  },

  rejectChange: (index) => {
    const { tabs } = get();
    if (!tabs[index]?.diff) return;
    const updated = [...tabs];
    updated[index] = {
      ...updated[index],
      content: updated[index].diff!.original,
      diff: undefined,
    };
    set({ tabs: updated });
  },
}));

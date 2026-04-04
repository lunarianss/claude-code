import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { FileTreePanel } from '../panels/FileTree';
import { ChatPanel } from '../panels/ChatPanel';
import { EditorPanel } from '../panels/EditorPanel';

export function MainLayout() {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      {/* Left panel - File tree + Sessions */}
      <Panel defaultSize={18} minSize={12} maxSize={30}>
        <FileTreePanel />
      </Panel>

      <PanelResizeHandle />

      {/* Center panel - Chat */}
      <Panel defaultSize={50} minSize={30}>
        <ChatPanel />
      </Panel>

      <PanelResizeHandle />

      {/* Right panel - Editor preview */}
      <Panel defaultSize={32} minSize={20} collapsible>
        <EditorPanel />
      </Panel>
    </PanelGroup>
  );
}

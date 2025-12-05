// Type definitions for Claude Agent plugin

export const VIEW_TYPE_CLAUDE_AGENT = 'claude-agent-view';

export interface ClaudeAgentSettings {
  // CLI configuration
  claudePath: string;

  // Permission model
  enableBlocklist: boolean;
  blockedCommands: string[];

  // Context
  systemPrompt: string;

  // UI preferences
  showToolUse: boolean;
}

export const DEFAULT_SETTINGS: ClaudeAgentSettings = {
  claudePath: 'claude',
  enableBlocklist: true,
  blockedCommands: [
    'rm -rf',
    'rm -r /',
    'chmod 777',
    'chmod -R 777',
    'mkfs',
    'dd if=',
    '> /dev/sd',
  ],
  systemPrompt: '',
  showToolUse: true,
};

// Message types for the chat UI
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolUse?: ToolUseInfo[];
}

export interface ToolUseInfo {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  blocked?: boolean;
}

// Stream chunk types from Claude Agent SDK
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; content: string }
  | { type: 'error'; content: string }
  | { type: 'blocked'; content: string }
  | { type: 'done' };

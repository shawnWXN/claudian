// Type definitions for Claudian plugin

export const VIEW_TYPE_CLAUDIAN = 'claudian-view';

export interface ClaudianSettings {
  enableBlocklist: boolean;
  blockedCommands: string[];
  showToolUse: boolean;
  maxConversations: number;
}

export const DEFAULT_SETTINGS: ClaudianSettings = {
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
  showToolUse: true,
  maxConversations: 50,
};

// Conversation persistence types
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  sessionId: string | null;
  messages: ChatMessage[];
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview: string;
}

// Content block for tracking order of text and tool calls
export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; toolId: string };

// Message types for the chat UI
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  // Ordered content blocks to preserve streaming order
  contentBlocks?: ContentBlock[];
  // File paths attached to this message via @ mention or auto-attach
  contextFiles?: string[];
}

// Enhanced tool call tracking with status and result
export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  result?: string;
  isExpanded?: boolean;
}

// Stream chunk types from Claude Agent SDK
export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; content: string; isError?: boolean }
  | { type: 'error'; content: string }
  | { type: 'blocked'; content: string }
  | { type: 'done' };

// SDK Message Types (for type safety in message handling)
export interface SDKContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | unknown;
  is_error?: boolean;
}

export interface SDKMessageContent {
  content?: SDKContentBlock[];
}

export interface SDKStreamEvent {
  type: 'content_block_start' | 'content_block_delta';
  content_block?: SDKContentBlock;
  delta?: {
    type: 'text_delta';
    text?: string;
  };
}

export interface SDKMessage {
  type: 'system' | 'assistant' | 'user' | 'stream_event' | 'result' | 'error';
  subtype?: 'init' | string;
  session_id?: string;
  message?: SDKMessageContent;
  tool_use_result?: string | unknown;
  parent_tool_use_id?: string;
  event?: SDKStreamEvent;
  error?: string;
}

# CLAUDE.md

## Project Overview

Claudian - An Obsidian plugin that embeds Claude Code as a sidebar chat interface. The vault directory becomes Claude's working directory, giving it full agentic capabilities: file read/write, bash commands, and multi-step workflows.

**Core Principle**: "Claude Code in a sidebar" - the full Claude Code experience embedded in Obsidian.

## Architecture

```
src/
├── main.ts            # Plugin entry point, registers view and settings
├── ClaudianView.ts    # Sidebar chat UI (ItemView), handles streaming display
├── ClaudianService.ts # Claude Agent SDK wrapper, transforms SDK messages
├── ClaudianSettings.ts # Settings tab
├── systemPrompt.ts    # System prompt for Claude agent
├── types.ts           # Shared type definitions (StreamChunk, ToolCallInfo, etc.)
└── utils.ts           # Utility functions (getVaultPath)
```

## Key Technologies

- **Claude Agent SDK**: `@anthropic-ai/claude-agent-sdk` for Claude integration
- **Obsidian API**: Plugin framework, ItemView for sidebar, MarkdownRenderer
- **Build**: esbuild with TypeScript
- **Target**: Desktop only (macOS, Linux, Windows via WSL)

## Commands

```bash
# Development (watch mode)
npm run dev

# Production build
npm run build

# Install dependencies
npm install
```

## Key Implementation Patterns

### Claude Agent SDK Usage
```typescript
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';

const options: Options = {
  cwd: vaultPath,
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  model: 'claude-haiku-4-5',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'LS'],
  abortController: this.abortController,
  pathToClaudeCodeExecutable: '/path/to/claude',
  resume: sessionId, // Optional: resume previous session
};

const response = query({ prompt, options });
for await (const message of response) {
  // Handle streaming messages
}
```

### Obsidian View Registration
```typescript
this.registerView(VIEW_TYPE_CLAUDIAN, (leaf) => new ClaudianView(leaf, this));
```

### Vault Path Access
```typescript
const vaultPath = this.app.vault.adapter.basePath;
```

### Markdown Rendering
```typescript
await MarkdownRenderer.renderMarkdown(markdown, container, sourcePath, component);
```

## SDK Message Types

| Type | Description |
|------|-------------|
| `system` | Session initialization (subtype: 'init' includes session_id), status updates |
| `assistant` | Claude's response containing content blocks (text and/or tool_use) |
| `user` | User messages, also contains tool results via `tool_use_result` field |
| `stream_event` | Streaming deltas (content_block_start, content_block_delta) |
| `result` | Terminal message indicating completion |
| `error` | Error messages |

### Content Block Types (inside assistant.message.content)
- `text` - Text content with `text` field
- `tool_use` - Tool invocation with `id`, `name`, and `input` fields

### Tool Result Location (inside user messages)
- `user.tool_use_result` - The result of tool execution
- `user.parent_tool_use_id` - Links result to the original tool_use

## Settings Structure

```typescript
interface ClaudianSettings {
  enableBlocklist: boolean;      // Block dangerous commands
  blockedCommands: string[];     // Regex patterns to block
  showToolUse: boolean;          // Show file operations in chat
}
```

## Default Blocked Commands

- `rm -rf`
- `rm -r /`
- `chmod 777`
- `chmod -R 777`
- `mkfs`
- `dd if=`
- `> /dev/sd`

## File Outputs

- `main.js` - Bundled plugin code
- `styles.css` - Plugin styles
- `manifest.json` - Obsidian plugin manifest

## External Dependencies

- User must have Claude Code CLI installed (SDK uses it internally via `pathToClaudeCodeExecutable`)
- Obsidian v1.0.0+

## CSS Class Conventions

### Layout
- `.claudian-container` - Main container
- `.claudian-header` - Header with title and action buttons
- `.claudian-title` - Logo and title container
- `.claudian-header-actions` - Right side action buttons container
- `.claudian-header-btn` - Icon buttons in header (history, new)
- `.claudian-messages` - Messages scroll area
- `.claudian-input-container` - Input area wrapper
- `.claudian-input` - Textarea input

### Chat History
- `.claudian-history-container` - Dropdown container (positioned relative)
- `.claudian-history-menu` - Dropdown menu (anchored to right)
- `.claudian-history-header` - "Conversations" header in dropdown
- `.claudian-history-list` - Scrollable conversation list
- `.claudian-history-item` - Individual conversation entry
- `.claudian-history-item-icon` - Chat icon for each entry
- `.claudian-history-item-content` - Title and date container
- `.claudian-history-item-title` - Conversation title (first 50 chars)
- `.claudian-history-item-date` - Timestamp metadata
- `.claudian-history-item-actions` - Rename/delete buttons

### Messages
- `.claudian-message` - Individual message
- `.claudian-message-user` - User message styling
- `.claudian-message-assistant` - Assistant message styling
- `.claudian-message-content` - Message content wrapper
- `.claudian-text-block` - Text block within message (maintains stream order)

### Tool Calls
- `.claudian-tool-call` - Tool call container (collapsible)
- `.claudian-tool-header` - Clickable header with tool info
- `.claudian-tool-chevron` - Expand/collapse chevron icon
- `.claudian-tool-icon` - Tool type icon
- `.claudian-tool-label` - Tool name and summary
- `.claudian-tool-status` - Status indicator (running/completed/error)
- `.claudian-spinner` - Loading spinner animation
- `.claudian-tool-content` - Collapsible content area
- `.claudian-tool-input` - Input parameters section
- `.claudian-tool-result` - Result output section
- `.claudian-tool-code` - Code/output display

### File Context
- `.claudian-file-indicator` - Container for attached file chips
- `.claudian-file-chip` - Individual file tag (pill style)
- `.claudian-file-chip-icon` - File icon in chip
- `.claudian-file-chip-name` - Filename text
- `.claudian-file-chip-remove` - Remove button (×)
- `.claudian-mention-dropdown` - @ mention file picker dropdown
- `.claudian-mention-item` - Individual file option in dropdown
- `.claudian-mention-icon` - File icon in dropdown
- `.claudian-mention-path` - File path text in dropdown
- `.claudian-mention-empty` - "No matching files" message

## Notes
- when ask to generate a md file about the finding, implementation of your work, put the file in dev/
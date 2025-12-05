# PRD: Obsidian Claude Agent Plugin

> **Approach**: Build from scratch using Claude Agent SDK  
> **Status**: Draft v2.0  
> **Date**: 2025-12-05

---

## 1. Overview

### What We're Building

An Obsidian plugin that embeds Claude Code as a sidebar chat interface. The vault directory becomes Claude's working directory, giving it full agentic capabilities: file read/write, bash commands, and multi-step workflows—all without leaving Obsidian.

### Core Principle

**"Claude Code in a sidebar"**—not a watered-down chat interface, but the full Claude Code experience embedded in Obsidian. If you can do it with `claude` in terminal, you should be able to do it in this plugin.

### Technical Approach

- Use the **Claude Agent SDK (TypeScript)** via `@anthropic-ai/claude-code`
- Obsidian plugin wraps the SDK, providing UI and vault integration
- YOLO permission mode with optional command blocklist

---

## 2. Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Sidebar chat interface for conversing with Claude | Must |
| F2 | Claude operates with vault as working directory | Must |
| F3 | Full Claude Code capabilities (read, write, bash, etc.) | Must |
| F4 | Streaming responses rendered in real-time | Must |
| F5 | Show tool use (file edits, commands) in chat | Must |
| F6 | Settings panel for configuration | Must |
| F7 | Configurable command blocklist | Should |
| F8 | Open files that Claude references/edits | Should |
| F9 | Session persistence across Obsidian restarts | Could |
| F10 | Context menu: "Ask Claude about this file" | Could |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NF1 | Time to first response token | < 2 seconds |
| NF2 | Plugin load time | < 500ms |
| NF3 | Memory footprint | < 100MB idle |
| NF4 | Works on macOS, Linux | Must |
| NF5 | Windows via WSL | Should |

### Dependencies

- **User must have installed**: Claude Code CLI (`claude` command available)
- **Plugin requires**: Node.js runtime (bundled with Obsidian's Electron)

---

## 3. Architecture

### System Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      Obsidian Plugin                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    ClaudeAgentView                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │ Message List│  │ Input Area  │  │  Toolbar        │   │  │
│  │  │ (scrollable)│  │ (textarea)  │  │  (actions)      │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                 ClaudeAgentService                       │  │
│  │  - Manages Claude Code SDK connection                    │  │
│  │  - Handles message streaming                             │  │
│  │  - Applies permission filters                            │  │
│  │  - Maintains conversation state                          │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │              Claude Agent SDK (TypeScript)               │  │
│  │              @anthropic-ai/claude-code                   │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────┼────────────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Claude Code    │
                   │  CLI Process    │
                   │  (cwd: vault)   │
                   └─────────────────┘
```

### Component Breakdown

#### 1. Main Plugin (`main.ts`)

```typescript
export default class ClaudeAgentPlugin extends Plugin {
  settings: ClaudeAgentSettings;
  agentService: ClaudeAgentService;

  async onload() {
    await this.loadSettings();
    
    // Register the sidebar view
    this.registerView(
      VIEW_TYPE_CLAUDE_AGENT,
      (leaf) => new ClaudeAgentView(leaf, this)
    );
    
    // Add ribbon icon to open the view
    this.addRibbonIcon('bot', 'Claude Agent', () => {
      this.activateView();
    });
    
    // Add settings tab
    this.addSettingTab(new ClaudeAgentSettingTab(this.app, this));
    
    // Initialize agent service
    this.agentService = new ClaudeAgentService(this);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLAUDE_AGENT)[0];
    
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_CLAUDE_AGENT, active: true });
    }
    
    workspace.revealLeaf(leaf);
  }
}
```

#### 2. Chat View (`ClaudeAgentView.ts`)

```typescript
export class ClaudeAgentView extends ItemView {
  private plugin: ClaudeAgentPlugin;
  private messages: Message[] = [];
  private inputEl: HTMLTextAreaElement;
  private messagesEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: ClaudeAgentPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_CLAUDE_AGENT; }
  getDisplayText(): string { return 'Claude Agent'; }
  getIcon(): string { return 'bot'; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('claude-agent-container');

    // Messages area
    this.messagesEl = container.createDiv({ cls: 'claude-agent-messages' });

    // Input area
    const inputContainer = container.createDiv({ cls: 'claude-agent-input-container' });
    this.inputEl = inputContainer.createEl('textarea', {
      cls: 'claude-agent-input',
      attr: { placeholder: 'Ask Claude anything...' }
    });

    // Send button
    const sendBtn = inputContainer.createEl('button', {
      cls: 'claude-agent-send-btn',
      text: 'Send'
    });

    // Event handlers
    sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  async sendMessage() {
    const content = this.inputEl.value.trim();
    if (!content) return;

    this.inputEl.value = '';
    this.addMessage({ role: 'user', content });

    // Stream response from Claude
    const responseEl = this.addMessage({ role: 'assistant', content: '' });
    
    try {
      for await (const chunk of this.plugin.agentService.query(content)) {
        this.updateMessage(responseEl, chunk);
      }
    } catch (error) {
      this.updateMessage(responseEl, { type: 'error', content: error.message });
    }
  }

  private addMessage(msg: Message): HTMLElement {
    const msgEl = this.messagesEl.createDiv({
      cls: `claude-agent-message claude-agent-message-${msg.role}`
    });
    msgEl.setText(msg.content);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msgEl;
  }

  private updateMessage(el: HTMLElement, chunk: StreamChunk) {
    // Handle different chunk types: text, tool_use, tool_result, etc.
    // Append to element, render markdown, etc.
  }
}
```

#### 3. Agent Service (`ClaudeAgentService.ts`)

```typescript
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-code';

export class ClaudeAgentService {
  private plugin: ClaudeAgentPlugin;

  constructor(plugin: ClaudeAgentPlugin) {
    this.plugin = plugin;
  }

  async *query(prompt: string): AsyncGenerator<StreamChunk> {
    const vaultPath = this.plugin.app.vault.adapter.basePath;
    
    const options: ClaudeAgentOptions = {
      cwd: vaultPath,
      permissionMode: 'bypassPermissions',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      // Add any custom system prompt
      systemPrompt: this.buildSystemPrompt(),
    };

    const stream = query({
      prompt,
      options,
    });

    for await (const message of stream) {
      // Filter blocked commands if enabled
      if (this.shouldBlock(message)) {
        yield { type: 'blocked', content: 'Command blocked by safety filter' };
        continue;
      }
      
      yield this.transformMessage(message);
    }
  }

  private buildSystemPrompt(): string {
    const vault = this.plugin.app.vault;
    return `You are Claude, operating inside an Obsidian vault.
Working directory: ${vault.adapter.basePath}
Total notes: ${vault.getMarkdownFiles().length}

Help the user manage their notes, write content, organize files, and build their knowledge base.`;
  }

  private shouldBlock(message: any): boolean {
    if (!this.plugin.settings.enableBlocklist) return false;
    
    // Check if this is a bash tool use
    if (message.type === 'tool_use' && message.name === 'Bash') {
      const command = message.input?.command || '';
      return this.plugin.settings.blockedCommands.some(
        pattern => new RegExp(pattern).test(command)
      );
    }
    return false;
  }

  private transformMessage(message: any): StreamChunk {
    // Transform SDK messages into our StreamChunk format
    switch (message.type) {
      case 'assistant':
        return { type: 'text', content: message.message.content };
      case 'tool_use':
        return { type: 'tool_use', tool: message.name, input: message.input };
      case 'tool_result':
        return { type: 'tool_result', content: message.content };
      default:
        return { type: 'unknown', raw: message };
    }
  }
}
```

#### 4. Settings (`ClaudeAgentSettings.ts`)

```typescript
export interface ClaudeAgentSettings {
  // Permission model
  enableBlocklist: boolean;
  blockedCommands: string[];
  
  // Context
  systemPrompt: string;
  
  // UI preferences
  showToolUse: boolean;
}

export const DEFAULT_SETTINGS: ClaudeAgentSettings = {
  enableBlocklist: true,
  blockedCommands: [
    'rm -rf',
    'rm -r /',
    'chmod 777',
    'mkfs',
    'dd if=',
  ],
  systemPrompt: '',
  showToolUse: true,
};

export class ClaudeAgentSettingTab extends PluginSettingTab {
  plugin: ClaudeAgentPlugin;

  constructor(app: App, plugin: ClaudeAgentPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Claude Agent Settings' });

    new Setting(containerEl)
      .setName('Enable command blocklist')
      .setDesc('Block dangerous bash commands')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableBlocklist)
        .onChange(async (value) => {
          this.plugin.settings.enableBlocklist = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Blocked commands')
      .setDesc('Regex patterns for commands to block (one per line)')
      .addTextArea(text => text
        .setValue(this.plugin.settings.blockedCommands.join('\n'))
        .onChange(async (value) => {
          this.plugin.settings.blockedCommands = value.split('\n').filter(s => s.trim());
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Custom system prompt')
      .setDesc('Additional instructions for Claude (optional)')
      .addTextArea(text => text
        .setValue(this.plugin.settings.systemPrompt)
        .onChange(async (value) => {
          this.plugin.settings.systemPrompt = value;
          await this.plugin.saveSettings();
        }));
  }
}
```

---

## 4. Project Structure

```
obsidian-claude-agent/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── ClaudeAgentView.ts      # Sidebar chat view
│   ├── ClaudeAgentService.ts   # Claude SDK wrapper
│   ├── ClaudeAgentSettings.ts  # Settings types and tab
│   ├── types.ts                # Shared type definitions
│   └── utils/
│       ├── markdown.ts         # Markdown rendering helpers
│       └── commands.ts         # Command blocklist logic
├── styles.css                  # Plugin styles
├── manifest.json               # Obsidian plugin manifest
├── package.json
├── tsconfig.json
├── esbuild.config.mjs          # Build configuration
└── README.md
```

---

## 5. Key Implementation Details

### 5.1 Using Claude Agent SDK

The SDK exposes a `query()` function that returns an async generator:

```typescript
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-code';

const options: ClaudeAgentOptions = {
  cwd: '/path/to/vault',
  permissionMode: 'bypassPermissions',  // YOLO mode
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
};

for await (const message of query({ prompt: 'Hello', options })) {
  console.log(message);
}
```

Message types you'll receive:

| Type | Description |
|------|-------------|
| `system` | Session initialization, metadata |
| `assistant` | Claude's text responses |
| `tool_use` | Claude invoking a tool (file read, bash, etc.) |
| `tool_result` | Result of tool execution |
| `user` | Echoed user messages |

### 5.2 Handling Tool Use in UI

When Claude uses tools, show it meaningfully:

```typescript
function renderToolUse(tool: ToolUse): HTMLElement {
  const el = createDiv({ cls: 'tool-use' });
  
  switch (tool.name) {
    case 'Read':
      el.setText(`📖 Reading: ${tool.input.file_path}`);
      break;
    case 'Write':
      el.setText(`✏️ Writing: ${tool.input.file_path}`);
      break;
    case 'Edit':
      el.setText(`🔧 Editing: ${tool.input.file_path}`);
      break;
    case 'Bash':
      el.setText(`💻 Running: ${tool.input.command}`);
      break;
    default:
      el.setText(`🔧 ${tool.name}`);
  }
  
  return el;
}
```

### 5.3 Command Blocklist Implementation

Simple regex-based blocking:

```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+(-[rf]+\s+)*\//,           // rm -rf /
  /rm\s+-[rf]*\s+~\//,             // rm -rf ~/
  /chmod\s+777/,                   // chmod 777
  /:()\s*{\s*:\|:&\s*}\s*;:/,     // Fork bomb
  /mkfs/,                          // Format filesystem
  /dd\s+if=.*of=\/dev/,           // dd to device
  />\s*\/dev\/sd[a-z]/,           // Write to disk
];

function isBlocked(command: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(command));
}
```

### 5.4 Markdown Rendering

Use Obsidian's built-in markdown renderer for Claude's responses:

```typescript
import { MarkdownRenderer, Component } from 'obsidian';

async function renderMarkdown(
  markdown: string,
  container: HTMLElement,
  sourcePath: string,
  component: Component
) {
  await MarkdownRenderer.renderMarkdown(
    markdown,
    container,
    sourcePath,
    component
  );
}
```

---

## 6. Styling

```css
/* styles.css */

.claude-agent-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

.claude-agent-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.claude-agent-message {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 90%;
}

.claude-agent-message-user {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  margin-left: auto;
}

.claude-agent-message-assistant {
  background: var(--background-secondary);
}

.claude-agent-input-container {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--background-modifier-border);
}

.claude-agent-input {
  flex: 1;
  min-height: 60px;
  resize: vertical;
}

.claude-agent-send-btn {
  align-self: flex-end;
}

/* Tool use indicators */
.claude-agent-tool-use {
  font-size: 0.85em;
  color: var(--text-muted);
  padding: 4px 8px;
  background: var(--background-primary-alt);
  border-radius: 4px;
  margin: 4px 0;
}

/* Code blocks in responses */
.claude-agent-message pre {
  background: var(--background-primary);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}
```

---

## 7. Build Configuration

### package.json

```json
{
  "name": "obsidian-claude-agent",
  "version": "0.1.0",
  "description": "Claude Code agent embedded in Obsidian",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "version": "node version-bump.mjs && git add manifest.json versions.json"
  },
  "devDependencies": {
    "@anthropic-ai/claude-code": "^0.2.0",
    "@types/node": "^20.0.0",
    "builtin-modules": "^3.3.0",
    "esbuild": "^0.20.0",
    "obsidian": "latest",
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES6", "ES7"]
  },
  "include": ["src/**/*.ts"]
}
```

### esbuild.config.mjs

```javascript
import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';

const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

### manifest.json

```json
{
  "id": "claude-agent",
  "name": "Claude Agent",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "Claude Code agent embedded in Obsidian sidebar",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourusername",
  "isDesktopOnly": true
}
```

---

## 8. Development Phases

### Phase 1: MVP (1-2 weeks)

- [ ] Project scaffold with build system
- [ ] Basic sidebar view with chat UI
- [ ] Claude Agent SDK integration
- [ ] Streaming responses
- [ ] Settings panel (blocklist toggle)

### Phase 2: Polish (1 week)

- [ ] Proper markdown rendering
- [ ] Tool use visualization
- [ ] Error handling and user feedback
- [ ] Keyboard shortcuts (Cmd+Enter to send)
- [ ] Command blocklist implementation

### Phase 3: Obsidian Integration (1 week)

- [ ] Open files that Claude edits
- [ ] Current file context in prompts
- [ ] Status bar indicator
- [ ] Commands palette integration

### Phase 4: Advanced (Future)

- [ ] Session persistence
- [ ] Chat history export
- [ ] Context menu integration
- [ ] Custom slash commands

---

## 9. Testing Plan

### Manual Testing Checklist

- [ ] Send message, receive streaming response
- [ ] Claude reads a file from vault
- [ ] Claude creates a new note
- [ ] Claude edits an existing note
- [ ] Claude runs a bash command
- [ ] Blocked command is rejected
- [ ] Long conversation works
- [ ] Cancel mid-response
- [ ] Plugin reload preserves nothing (stateless)
- [ ] Settings changes take effect

### Test Prompts

```
# Basic
"List all markdown files in this vault"

# File read
"Read the contents of my daily note from today"

# File write
"Create a new note called 'test.md' with some sample content"

# File edit
"Add a new heading called 'Ideas' to test.md"

# Bash
"Show me the folder structure of this vault"

# Blocked (should fail if blocklist enabled)
"Run rm -rf /"

# Complex
"Find all notes tagged #project and create a summary note linking to each"
```

---

## 10. Open Questions

1. **SDK bundling**: Does `@anthropic-ai/claude-code` bundle cleanly with esbuild, or does it need special handling for the CLI dependency?

2. **Path detection**: How to reliably get the vault's filesystem path in all environments?

3. **Windows**: Does the SDK work on Windows natively, or only via WSL?

4. **Session state**: Should we persist conversation across Obsidian restarts? (Start with no, add later if needed.)

5. **Model selection**: Expose model choice in settings, or use SDK defaults?

---

## 11. References

### Obsidian
- [Plugin API](https://github.com/obsidianmd/obsidian-api)
- [Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Developer Docs](https://docs.obsidian.md/)

### Claude Agent SDK
- [Overview](https://docs.claude.com/en/api/agent-sdk/overview)
- [TypeScript Reference](https://docs.claude.com/en/api/agent-sdk/typescript)
- [NPM Package](https://www.npmjs.com/package/@anthropic-ai/claude-code)

---

*End of PRD v2*

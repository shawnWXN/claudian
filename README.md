# Claudian

An Obsidian plugin that embeds Claude Code as a sidebar chat interface. Your vault becomes Claude's working directory, giving it full agentic capabilities: file read/write, bash commands, and multi-step workflows.

## Features

- **Sidebar chat interface**: Talk to Claude without leaving Obsidian
- **Full Claude Code capabilities**: Read, write, edit files, run bash commands
- **Vault-aware**: Claude operates with your vault as the working directory
- **File context awareness**: Auto-attach focused note, or use `@` to mention files
- **Streaming responses**: See Claude's responses in real-time
- **Tool call visualization**: Collapsible UI showing tool inputs and results (like Claude Code CLI)
- **Chat history persistence**: Conversations saved across sessions with easy switching
- **Session resume**: Continue previous conversations with full context
- **Safety blocklist**: Optionally block dangerous commands
- **Cancel streaming**: Press Escape to stop a response mid-stream

## Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed (the SDK uses it internally)
- Obsidian v1.0.0+
- Desktop only (macOS, Linux, Windows via WSL)

## Installation

### From source (development)

1. Clone this repository into your vault's plugins folder:
   ```bash
   cd /path/to/vault/.obsidian/plugins
   git clone https://github.com/yourusername/claudian.git
   cd claudian
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Enable the plugin in Obsidian:
   - Settings → Community plugins → Enable "Claudian"

### Development

```bash
# Watch mode (auto-rebuild on changes)
npm run dev

# Production build
npm run build
```

## Usage

1. Click the bot icon in the ribbon (left sidebar) to open Claudian
2. Type your message and press Enter to send (Shift+Enter for newline)
3. Claude can read, write, and edit files in your vault
4. Click on tool call headers to expand and see inputs/results

### File Context

- **Auto-attach**: New conversations auto-attach the currently focused note
- **@ mention**: Type `@` anywhere to search and attach files from your vault
- **Remove**: Click `×` on a file chip to remove it
- Files are sent as context with your message; Claude will read them to understand your question

### Example prompts

- "List all notes in this vault"
- "Create a new note called 'Ideas' with a template for brainstorming"
- "Find all notes tagged #project and summarize them"
- "Organize my daily notes into monthly folders"
- "Summarize this note" (with a note attached via @ or auto-attach)

## Configuration

### Settings

- **Enable command blocklist**: Block dangerous bash commands (default: on)
- **Blocked commands**: Patterns to block (supports regex)
- **Show tool usage**: Display file operations in chat

### Default blocklist

- `rm -rf`
- `rm -r /`
- `chmod 777`
- `chmod -R 777`
- `mkfs`
- `dd if=`
- `> /dev/sd`

## Architecture

```
src/
├── main.ts            # Plugin entry point
├── ClaudianView.ts    # Sidebar chat UI with tool call display
├── ClaudianService.ts # Claude Agent SDK wrapper
├── ClaudianSettings.ts # Settings tab
├── systemPrompt.ts    # System prompt for Claude
├── types.ts           # Type definitions
└── utils.ts           # Utility functions
```

## Roadmap

- [x] Session persistence within sessions (via SDK resume)
- [x] Chat history persistence across plugin restarts
- [x] Conversation switching with history dropdown
- [x] File context awareness (auto-attach + @ mention)
- [x] Context menu: "Ask Claude about this file"
- [ ] Open files that Claude edits
- [ ] Chat history export
- [ ] Model selection and thinking level adjustment

## License

Licensed under the [MIT License](LICENSE).

## Acknowledgments

- [Obsidian](https://obsidian.md) for the plugin API
- [Anthropic](https://anthropic.com) for Claude and the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)

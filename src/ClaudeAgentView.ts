import { ItemView, WorkspaceLeaf, MarkdownRenderer, setIcon } from 'obsidian';
import type ClaudeAgentPlugin from './main';
import { VIEW_TYPE_CLAUDE_AGENT, ChatMessage, StreamChunk } from './types';

export class ClaudeAgentView extends ItemView {
  private plugin: ClaudeAgentPlugin;
  private messages: ChatMessage[] = [];
  private messagesEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private isStreaming = false;

  constructor(leaf: WorkspaceLeaf, plugin: ClaudeAgentPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CLAUDE_AGENT;
  }

  getDisplayText(): string {
    return 'Claude Agent';
  }

  getIcon(): string {
    return 'bot';
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('claude-agent-container');

    // Header
    const header = container.createDiv({ cls: 'claude-agent-header' });
    header.createEl('h4', { text: 'Claude Agent' });

    const clearBtn = header.createEl('button', { cls: 'claude-agent-clear-btn' });
    setIcon(clearBtn, 'trash');
    clearBtn.setAttribute('aria-label', 'Clear conversation');
    clearBtn.addEventListener('click', () => this.clearConversation());

    // Messages area
    this.messagesEl = container.createDiv({ cls: 'claude-agent-messages' });

    // Input area
    const inputContainer = container.createDiv({ cls: 'claude-agent-input-container' });

    this.inputEl = inputContainer.createEl('textarea', {
      cls: 'claude-agent-input',
      attr: {
        placeholder: 'Ask Claude anything... (Cmd/Ctrl+Enter to send)',
        rows: '3',
      },
    });

    const buttonContainer = inputContainer.createDiv({ cls: 'claude-agent-buttons' });

    const sendBtn = buttonContainer.createEl('button', {
      cls: 'claude-agent-send-btn mod-cta',
      text: 'Send',
    });

    // Event handlers
    sendBtn.addEventListener('click', () => this.sendMessage());

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Welcome message
    this.addSystemMessage('Claude Agent ready. Your vault is the working directory.');
  }

  async onClose() {
    // Cleanup if needed
  }

  private async sendMessage() {
    const content = this.inputEl.value.trim();
    if (!content || this.isStreaming) return;

    this.inputEl.value = '';
    this.isStreaming = true;

    // Add user message
    this.addMessage({
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    // Create assistant message placeholder
    const assistantMsg: ChatMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolUse: [],
    };
    const msgEl = this.addMessage(assistantMsg);
    const textEl = msgEl.querySelector('.claude-agent-message-text') as HTMLElement;
    const toolsEl = msgEl.querySelector('.claude-agent-message-tools') as HTMLElement;

    try {
      for await (const chunk of this.plugin.agentService.query(content)) {
        this.handleStreamChunk(chunk, assistantMsg, textEl, toolsEl);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      assistantMsg.content += `\n\n**Error:** ${errorMsg}`;
      await this.renderContent(textEl, assistantMsg.content);
    } finally {
      this.isStreaming = false;
    }
  }

  private async handleStreamChunk(
    chunk: StreamChunk,
    msg: ChatMessage,
    textEl: HTMLElement,
    toolsEl: HTMLElement
  ) {
    switch (chunk.type) {
      case 'text':
        msg.content += chunk.content;
        await this.renderContent(textEl, msg.content);
        break;

      case 'tool_use':
        if (this.plugin.settings.showToolUse) {
          msg.toolUse = msg.toolUse || [];
          msg.toolUse.push({ name: chunk.name, input: chunk.input });
          this.renderToolUse(toolsEl, chunk.name, chunk.input);
        }
        break;

      case 'tool_result':
        // Tool results are usually incorporated into Claude's response
        break;

      case 'blocked':
        msg.content += `\n\n⚠️ **Blocked:** ${chunk.content}`;
        await this.renderContent(textEl, msg.content);
        break;

      case 'error':
        msg.content += `\n\n❌ **Error:** ${chunk.content}`;
        await this.renderContent(textEl, msg.content);
        break;

      case 'done':
        // Streaming complete
        break;
    }

    // Auto-scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private addMessage(msg: ChatMessage): HTMLElement {
    this.messages.push(msg);

    const msgEl = this.messagesEl.createDiv({
      cls: `claude-agent-message claude-agent-message-${msg.role}`,
    });

    const contentEl = msgEl.createDiv({ cls: 'claude-agent-message-content' });
    const textEl = contentEl.createDiv({ cls: 'claude-agent-message-text' });
    const toolEl = contentEl.createDiv({ cls: 'claude-agent-message-tools' });

    if (msg.content) {
      this.renderContent(textEl, msg.content);
    }

    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msgEl;
  }

  private addSystemMessage(content: string) {
    const msgEl = this.messagesEl.createDiv({
      cls: 'claude-agent-message claude-agent-message-system',
    });
    msgEl.setText(content);
  }

  private async renderContent(el: HTMLElement, markdown: string) {
    el.empty();
    await MarkdownRenderer.renderMarkdown(markdown, el, '', this);
  }

  private renderToolUse(parentEl: HTMLElement, name: string, input: Record<string, unknown>) {
    const toolEl = parentEl.createDiv({ cls: 'claude-agent-tool-use' });

    let icon = '🔧';
    let label = name;

    switch (name) {
      case 'Read':
        icon = '📖';
        label = `Reading: ${input.file_path || 'file'}`;
        break;
      case 'Write':
        icon = '✏️';
        label = `Writing: ${input.file_path || 'file'}`;
        break;
      case 'Edit':
        icon = '🔧';
        label = `Editing: ${input.file_path || 'file'}`;
        break;
      case 'Bash':
        icon = '💻';
        label = `Running: ${input.command || 'command'}`;
        break;
      case 'Glob':
        icon = '🔍';
        label = `Finding: ${input.pattern || 'files'}`;
        break;
      case 'Grep':
        icon = '🔎';
        label = `Searching: ${input.pattern || 'pattern'}`;
        break;
    }

    toolEl.setText(`${icon} ${label}`);
  }

  private clearConversation() {
    this.messages = [];
    this.messagesEl.empty();
    this.addSystemMessage('Conversation cleared. Ready for new messages.');
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

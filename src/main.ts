import { Plugin } from 'obsidian';
import { ClaudianView } from './ClaudianView';
import { ClaudianService } from './ClaudianService';
import { ClaudianSettingTab } from './ClaudianSettings';
import { ClaudianSettings, DEFAULT_SETTINGS, VIEW_TYPE_CLAUDIAN, Conversation, ConversationMeta } from './types';

export default class ClaudianPlugin extends Plugin {
  settings: ClaudianSettings;
  agentService: ClaudianService;
  private conversations: Conversation[] = [];
  private activeConversationId: string | null = null;

  async onload() {
    console.log('Loading Claudian plugin');

    await this.loadSettings();

    // Initialize agent service
    this.agentService = new ClaudianService(this);

    // Register the sidebar view
    this.registerView(
      VIEW_TYPE_CLAUDIAN,
      (leaf) => new ClaudianView(leaf, this)
    );

    // Add ribbon icon to open the view
    this.addRibbonIcon('bot', 'Open Claudian', () => {
      this.activateView();
    });

    // Add command to open view
    this.addCommand({
      id: 'open-claudian',
      name: 'Open Claudian',
      callback: () => {
        this.activateView();
      },
    });

    // Add settings tab
    this.addSettingTab(new ClaudianSettingTab(this.app, this));
  }

  onunload() {
    console.log('Unloading Claudian plugin');
    this.agentService.cleanup();
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0];

    if (!leaf) {
      // Get the right leaf (sidebar)
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_CLAUDIAN,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async loadSettings() {
    const data = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.conversations = data.conversations || [];
    this.activeConversationId = data.activeConversationId || null;

    // Validate active conversation still exists
    if (this.activeConversationId &&
        !this.conversations.find(c => c.id === this.activeConversationId)) {
      this.activeConversationId = null;
    }
  }

  async saveSettings() {
    await this.saveData({
      ...this.settings,
      conversations: this.conversations,
      activeConversationId: this.activeConversationId,
    });
  }

  /**
   * Generate a unique conversation ID
   */
  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate a default title with timestamp
   */
  private generateDefaultTitle(): string {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get preview text from a conversation
   */
  private getConversationPreview(conv: Conversation): string {
    const firstUserMsg = conv.messages.find(m => m.role === 'user');
    if (!firstUserMsg) return 'New conversation';
    return firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
  }

  /**
   * Prune old conversations to stay within limit
   */
  private pruneOldConversations(): void {
    const max = this.settings.maxConversations || 50;
    if (this.conversations.length <= max) {
      return;
    }

    const activeId = this.activeConversationId;
    const pruned = this.conversations.slice(0, max);

    if (activeId && !pruned.some(c => c.id === activeId)) {
      const activeConversation = this.conversations.find(c => c.id === activeId);
      if (activeConversation) {
        pruned.pop();
        pruned.push(activeConversation);
      }
    }

    this.conversations = pruned;

    if (this.activeConversationId && !this.conversations.some(c => c.id === this.activeConversationId)) {
      const fallback = this.conversations[0];
      this.activeConversationId = fallback ? fallback.id : null;
      this.agentService.setSessionId(fallback?.sessionId ?? null);
    }
  }

  /**
   * Create a new conversation and set it as active
   */
  async createConversation(): Promise<Conversation> {
    const conversation: Conversation = {
      id: this.generateConversationId(),
      title: this.generateDefaultTitle(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionId: null,
      messages: [],
    };

    // Add to front of list
    this.conversations.unshift(conversation);
    this.activeConversationId = conversation.id;

    // Enforce max limit
    this.pruneOldConversations();

    // Reset agent service session
    this.agentService.resetSession();

    await this.saveSettings();
    return conversation;
  }

  /**
   * Switch to an existing conversation
   */
  async switchConversation(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.find(c => c.id === id);
    if (!conversation) return null;

    this.activeConversationId = id;

    // Restore session ID to agent service
    this.agentService.setSessionId(conversation.sessionId);

    await this.saveSettings();
    return conversation;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<void> {
    const index = this.conversations.findIndex(c => c.id === id);
    if (index === -1) return;

    this.conversations.splice(index, 1);

    // If deleted active conversation, switch to newest or create new
    if (this.activeConversationId === id) {
      if (this.conversations.length > 0) {
        await this.switchConversation(this.conversations[0].id);
      } else {
        await this.createConversation();
      }
    } else {
      await this.saveSettings();
    }
  }

  /**
   * Rename a conversation
   */
  async renameConversation(id: string, title: string): Promise<void> {
    const conversation = this.conversations.find(c => c.id === id);
    if (!conversation) return;

    conversation.title = title.trim() || this.generateDefaultTitle();
    conversation.updatedAt = Date.now();
    await this.saveSettings();
  }

  /**
   * Update conversation (messages, sessionId, etc.)
   */
  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    const conversation = this.conversations.find(c => c.id === id);
    if (!conversation) return;

    Object.assign(conversation, updates, { updatedAt: Date.now() });
    await this.saveSettings();
  }

  /**
   * Get current active conversation
   */
  getActiveConversation(): Conversation | null {
    return this.conversations.find(c => c.id === this.activeConversationId) || null;
  }

  /**
   * Get conversation metadata list for dropdown
   */
  getConversationList(): ConversationMeta[] {
    return this.conversations.map(c => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
      preview: this.getConversationPreview(c),
    }));
  }
}

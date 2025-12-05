import { Plugin } from 'obsidian';
import { ClaudeAgentView } from './ClaudeAgentView';
import { ClaudeAgentService } from './ClaudeAgentService';
import { ClaudeAgentSettingTab } from './ClaudeAgentSettings';
import { ClaudeAgentSettings, DEFAULT_SETTINGS, VIEW_TYPE_CLAUDE_AGENT } from './types';

export default class ClaudeAgentPlugin extends Plugin {
  settings: ClaudeAgentSettings;
  agentService: ClaudeAgentService;

  async onload() {
    console.log('Loading Claude Agent plugin');

    await this.loadSettings();

    // Initialize agent service
    this.agentService = new ClaudeAgentService(this);

    // Register the sidebar view
    this.registerView(
      VIEW_TYPE_CLAUDE_AGENT,
      (leaf) => new ClaudeAgentView(leaf, this)
    );

    // Add ribbon icon to open the view
    this.addRibbonIcon('bot', 'Open Claude Agent', () => {
      this.activateView();
    });

    // Add command to open view
    this.addCommand({
      id: 'open-claude-agent',
      name: 'Open Claude Agent',
      callback: () => {
        this.activateView();
      },
    });

    // Add settings tab
    this.addSettingTab(new ClaudeAgentSettingTab(this.app, this));
  }

  onunload() {
    console.log('Unloading Claude Agent plugin');
    this.agentService.cleanup();
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLAUDE_AGENT)[0];

    if (!leaf) {
      // Get the right leaf (sidebar)
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_CLAUDE_AGENT,
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

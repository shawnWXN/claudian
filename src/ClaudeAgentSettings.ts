import { App, PluginSettingTab, Setting } from 'obsidian';
import type ClaudeAgentPlugin from './main';

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

    // CLI configuration section
    containerEl.createEl('h3', { text: 'CLI Configuration' });

    new Setting(containerEl)
      .setName('Claude CLI path')
      .setDesc('Full path to claude executable (run "which claude" in terminal)')
      .addText((text) =>
        text
          .setPlaceholder('/usr/local/bin/claude')
          .setValue(this.plugin.settings.claudePath)
          .onChange(async (value) => {
            this.plugin.settings.claudePath = value;
            await this.plugin.saveSettings();
          })
      );

    // Safety section
    containerEl.createEl('h3', { text: 'Safety' });

    new Setting(containerEl)
      .setName('Enable command blocklist')
      .setDesc('Block potentially dangerous bash commands')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableBlocklist)
          .onChange(async (value) => {
            this.plugin.settings.enableBlocklist = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Blocked commands')
      .setDesc('Patterns to block (one per line). Supports regex.')
      .addTextArea((text) => {
        text
          .setPlaceholder('rm -rf\nchmod 777\nmkfs')
          .setValue(this.plugin.settings.blockedCommands.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.blockedCommands = value
              .split('\n')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 6;
        text.inputEl.cols = 40;
      });

    // Context section
    containerEl.createEl('h3', { text: 'Context' });

    new Setting(containerEl)
      .setName('Custom system prompt')
      .setDesc('Additional instructions for Claude (optional)')
      .addTextArea((text) => {
        text
          .setPlaceholder('E.g., "Always use markdown formatting" or "Focus on concise responses"')
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.systemPrompt = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 40;
      });

    // UI section
    containerEl.createEl('h3', { text: 'Interface' });

    new Setting(containerEl)
      .setName('Show tool usage')
      .setDesc('Display when Claude reads, writes, or edits files')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showToolUse)
          .onChange(async (value) => {
            this.plugin.settings.showToolUse = value;
            await this.plugin.saveSettings();
          })
      );

    // Info section
    containerEl.createEl('h3', { text: 'Information' });

    const infoDiv = containerEl.createDiv({ cls: 'claude-agent-info' });
    infoDiv.createEl('p', {
      text: 'This plugin requires Claude Code CLI to be installed and available in your PATH.',
    });
    infoDiv.createEl('p', {
      text: 'Install it from: https://claude.ai/code',
    });

    const vaultPath = this.getVaultPath();
    if (vaultPath) {
      infoDiv.createEl('p', {
        text: `Vault path: ${vaultPath}`,
        cls: 'claude-agent-vault-path',
      });
    }
  }

  private getVaultPath(): string | null {
    const adapter = this.app.vault.adapter;
    if ('basePath' in adapter) {
      return (adapter as any).basePath;
    }
    return null;
  }
}

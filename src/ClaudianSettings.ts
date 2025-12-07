import { App, PluginSettingTab, Setting } from 'obsidian';
import type ClaudianPlugin from './main';
import { getVaultPath } from './utils';

export class ClaudianSettingTab extends PluginSettingTab {
  plugin: ClaudianPlugin;

  constructor(app: App, plugin: ClaudianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Claudian Settings' });

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

    const infoDiv = containerEl.createDiv({ cls: 'claudian-info' });
    infoDiv.createEl('p', {
      text: 'This plugin uses the Claude Agent SDK to interact with Claude.',
    });

    const vaultPath = getVaultPath(this.app);
    if (vaultPath) {
      infoDiv.createEl('p', {
        text: `Vault path: ${vaultPath}`,
        cls: 'claudian-vault-path',
      });
    }
  }
}

import * as vscode from 'vscode';
import { generateWebviewContent, generateErrorContent, generateNonce } from './webviewContent';
import { bundleComponent } from '../bundler/esbuildBundler';
import type { PreviewConfig } from '../parser/previewExtractor';

/**
 * Manages the React component preview webview panel
 */
export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this._extensionUri = extensionUri;

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  /**
   * Create or show the preview panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    viewColumn?: vscode.ViewColumn
  ): PreviewPanel {
    const column = viewColumn || vscode.ViewColumn.Beside;

    // If panel already exists, show it
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel.panel.reveal(column);
      return PreviewPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'reactPreview',
      'React Preview',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri);
    return PreviewPanel.currentPanel;
  }

  /**
   * Update the panel with new preview content
   */
  public async updatePreview(
    previewConfig: PreviewConfig,
    workspaceRoot: string
  ): Promise<void> {
    const { componentPath, componentName, states, isDefaultExport } = previewConfig;

    // Update panel title
    this.panel.title = `Preview: ${componentName}`;

    // Show loading state
    this.panel.webview.html = this.getLoadingHtml(componentName);

    try {
      // Bundle the component
      const bundleResult = await bundleComponent(
        componentPath,
        componentName,
        states,
        workspaceRoot,
        isDefaultExport
      );

      if (bundleResult.errors.length > 0) {
        // Show error content
        const nonce = generateNonce();
        this.panel.webview.html = generateErrorContent(
          componentName,
          bundleResult.errors,
          this.panel.webview.cspSource,
          nonce
        );
        return;
      }

      // Generate and set preview content
      const nonce = generateNonce();
      this.panel.webview.html = generateWebviewContent({
        bundledCode: bundleResult.code,
        componentName,
        stateNames: states.map(s => s.name),
        cspSource: this.panel.webview.cspSource,
        nonce
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nonce = generateNonce();
      this.panel.webview.html = generateErrorContent(
        componentName,
        [message],
        this.panel.webview.cspSource,
        nonce
      );
    }
  }

  /**
   * Get loading HTML
   */
  private getLoadingHtml(componentName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Loading: ${componentName}</title>
  <style>
    body {
      margin: 0;
      padding: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    .loading {
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      margin: 0 auto 16px;
      border: 3px solid var(--vscode-progressBar-background);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .text {
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <div class="text">Bundling ${componentName}...</div>
  </div>
</body>
</html>`;
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    PreviewPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

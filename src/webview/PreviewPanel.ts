import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
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
	private pendingPreview: { config: PreviewConfig; workspaceRoot: string } | null = null;

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this.panel = panel;
		this._extensionUri = extensionUri;

		// Handle panel disposal
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		// Handle messages from webview
		this.panel.webview.onDidReceiveMessage(
			(message) => this.handleWebviewMessage(message),
			null,
			this.disposables
		);
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
		const panel = vscode.window.createWebviewPanel('reactPreview', 'React Preview', column, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')]
		});

		PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri);

		// Set the initial HTML
		PreviewPanel.currentPanel.panel.webview.html = PreviewPanel.currentPanel.getWebviewHtml();

		return PreviewPanel.currentPanel;
	}

	/**
	 * Handle messages from the webview
	 */
	private async handleWebviewMessage(message: { type: string }): Promise<void> {
		console.log('[extension] Received message from webview:', message.type);

		switch (message.type) {
			case 'ready':
				console.log('[extension] Webview ready, pendingPreview:', !!this.pendingPreview);
				// Webview is ready, send pending preview if any
				if (this.pendingPreview) {
					await this.sendPreviewToWebview(
						this.pendingPreview.config,
						this.pendingPreview.workspaceRoot
					);
					this.pendingPreview = null;
				}
				break;
			case 'refresh':
				// Handle refresh request
				if (this.pendingPreview) {
					await this.sendPreviewToWebview(
						this.pendingPreview.config,
						this.pendingPreview.workspaceRoot
					);
				}
				break;
		}
	}

	/**
	 * Update the panel with new preview content
	 */
	public async updatePreview(previewConfig: PreviewConfig, workspaceRoot: string): Promise<void> {
		const { componentName } = previewConfig;

		// Update panel title
		this.panel.title = `Preview: ${componentName}`;

		// Store the preview config for when webview is ready
		this.pendingPreview = { config: previewConfig, workspaceRoot };

		// Try to send immediately (webview might already be ready)
		await this.sendPreviewToWebview(previewConfig, workspaceRoot);
	}

	/**
	 * Send preview data to the webview
	 */
	private async sendPreviewToWebview(
		previewConfig: PreviewConfig,
		workspaceRoot: string
	): Promise<void> {
		const { componentPath, componentName, states, isDefaultExport } = previewConfig;

		console.log('[extension] sendPreviewToWebview:', componentName);

		try {
			// Bundle the component
			const bundleResult = await bundleComponent(
				componentPath,
				componentName,
				states,
				workspaceRoot,
				isDefaultExport
			);

			console.log(
				'[extension] Bundle result - errors:',
				bundleResult.errors.length,
				'code length:',
				bundleResult.code.length
			);

			if (bundleResult.errors.length > 0) {
				this.panel.webview.postMessage({
					type: 'error',
					componentName,
					errors: bundleResult.errors
				});
				return;
			}

			// Send update to webview
			console.log('[extension] Posting update message to webview');
			this.panel.webview.postMessage({
				type: 'update',
				componentName,
				stateNames: states.map((s) => s.name),
				bundledCode: bundleResult.code
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.panel.webview.postMessage({
				type: 'error',
				componentName,
				errors: [message]
			});
		}
	}

	/**
	 * Get the webview HTML content by loading built webview-ui assets
	 */
	private getWebviewHtml(): string {
		const webview = this.panel.webview;
		const webviewPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');

		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'assets', 'index.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'assets', 'index.css'));

		const cssPath = path.join(this._extensionUri.fsPath, 'dist', 'webview', 'assets', 'index.css');
		const hasCss = fs.existsSync(cssPath);

		const nonce = generateNonce();
		const csp = [
			"default-src 'none'",
			`style-src ${webview.cspSource} 'unsafe-inline' https://cdn.tailwindcss.com`,
			`script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' ${webview.cspSource} https://cdn.tailwindcss.com`,
			`img-src ${webview.cspSource} data: https:`
		].join('; ');

		// Safelist common shadcn/ui classes so Tailwind CDN generates them
		const safelist = `
      bg-primary bg-secondary bg-destructive bg-muted bg-accent bg-background
      text-primary text-secondary text-destructive text-muted text-accent text-foreground
      text-primary-foreground text-secondary-foreground text-destructive-foreground text-muted-foreground text-accent-foreground
      border-primary border-secondary border-destructive border-muted border-accent border-input border-border
      hover:bg-primary/90 hover:bg-secondary/80 hover:bg-destructive/90 hover:bg-accent hover:bg-muted
      ring-ring focus:ring-ring focus-visible:ring-ring
      rounded-sm rounded-md rounded-lg rounded-full
      px-2 px-3 px-4 py-1 py-2 py-3 px-2.5 py-0.5
      text-xs text-sm text-base text-lg font-medium font-semibold
      inline-flex items-center justify-center gap-2
      h-8 h-9 h-10 h-11 w-full
      disabled:opacity-50 disabled:pointer-events-none
      transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    `.trim();

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>React Preview</title>
  <script src="https://cdn.tailwindcss.com" nonce="${nonce}"></script>
  <script nonce="${nonce}">
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
            secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
            destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
            muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
            accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
            card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
            popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
          },
          borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
        },
      },
    }
  </script>
  ${hasCss ? `<link rel="stylesheet" href="${styleUri}">` : ''}
</head>
<body>
  <!-- Safelist for Tailwind CDN to pre-generate common classes -->
  <div style="display:none!important" class="${safelist}"></div>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
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

function generateNonce(): string {
	return randomBytes(16).toString('base64');
}

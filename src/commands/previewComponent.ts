import * as vscode from 'vscode';
import * as path from 'path';
import { extractPreviewConfig } from '../parser/previewExtractor';
import { detectComponent } from '../parser/componentDetector';
import { PreviewPanel } from '../webview/PreviewPanel';

/**
 * Command handler for previewing React component states
 */
export async function previewComponent(
  context: vscode.ExtensionContext,
  uri?: vscode.Uri
): Promise<void> {
  // Get the file path from the URI or the active editor
  let filePath: string | undefined;

  if (uri) {
    filePath = uri.fsPath;
  } else {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      filePath = activeEditor.document.uri.fsPath;
    }
  }

  if (!filePath) {
    vscode.window.showErrorMessage('No file selected. Open a React component file first.');
    return;
  }

  // Validate file extension
  const ext = path.extname(filePath);
  if (!['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
    vscode.window.showErrorMessage('Please select a React component file (.tsx, .jsx, .ts, or .js)');
    return;
  }

  // Get workspace root
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Could not determine workspace folder. Please open a workspace.');
    return;
  }
  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Detect if this is a previewable component
  const componentInfo = await detectComponent(filePath);
  if (!componentInfo) {
    vscode.window.showWarningMessage(
      'No preview configuration found. Add an `export const preview = { ... }` to your component, ' +
      'or create a colocated .preview.ts file.'
    );
    return;
  }

  // Extract preview configuration
  const previewConfig = await extractPreviewConfig(filePath);
  if (!previewConfig || previewConfig.states.length === 0) {
    vscode.window.showWarningMessage(
      'Could not parse preview configuration. Check that your preview export is properly formatted.'
    );
    return;
  }

  // Show progress while bundling
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Previewing ${previewConfig.componentName}...`,
      cancellable: false
    },
    async () => {
      // Create or update the preview panel
      const panel = PreviewPanel.createOrShow(context.extensionUri);
      await panel.updatePreview(previewConfig, workspaceRoot);
    }
  );
}

/**
 * Register the preview command
 */
export function registerPreviewCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand(
    'live-comp.previewComponent',
    (uri?: vscode.Uri) => previewComponent(context, uri)
  );
}

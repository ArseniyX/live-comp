import * as vscode from 'vscode';
import * as path from 'path';
import { registerPreviewCommand } from './commands/previewComponent';
import { PreviewPanel } from './webview/PreviewPanel';

export function activate(context: vscode.ExtensionContext) {
	console.log('React Preview extension is now active');

	// Register the preview command
	const previewCommand = registerPreviewCommand(context);
	context.subscriptions.push(previewCommand);

	// Watch for file saves to refresh preview
	const saveWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
		const panel = PreviewPanel.currentPanel;
		if (!panel) {
			return;
		}

		const savedPath = document.uri.fsPath;
		const componentPath = panel.getComponentPath();
		if (!componentPath) {
			return;
		}

		// Check if saved file is the component or its preview file
		const componentDir = path.dirname(componentPath);
		const componentBase = path.basename(componentPath, path.extname(componentPath));
		const previewFileName = `${componentBase}.preview`;

		const isComponentFile = savedPath === componentPath;
		const isPreviewFile =
			path.dirname(savedPath) === componentDir &&
			path.basename(savedPath).startsWith(previewFileName);
		const isSameDirectory = path.dirname(savedPath) === componentDir;

		if (isComponentFile || isPreviewFile || isSameDirectory) {
			await panel.refresh();
		}
	});
	context.subscriptions.push(saveWatcher);
}

export function deactivate() {}

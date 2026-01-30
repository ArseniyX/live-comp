import * as vscode from 'vscode';
import { registerPreviewCommand } from './commands/previewComponent';

export function activate(context: vscode.ExtensionContext) {
	console.log('React Preview extension is now active');

	// Register the preview command
	const previewCommand = registerPreviewCommand(context);
	context.subscriptions.push(previewCommand);
}

export function deactivate() {}

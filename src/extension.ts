import * as vscode from 'vscode';
import * as path from 'path';
import { registerCreateProjectCommand } from './commands/createProject';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('DevLaunch extension is now active.');

	const templatesRoot = path.join(context.extensionUri.fsPath, 'templates');
	const createProjectDisposable = registerCreateProjectCommand(templatesRoot);
	context.subscriptions.push(createProjectDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

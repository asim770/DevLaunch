import * as vscode from 'vscode';
import { registerCreateProjectCommand } from './commands/createProject';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	console.log('DevLaunch extension is now active.');

	const createProjectDisposable = registerCreateProjectCommand();
	context.subscriptions.push(createProjectDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

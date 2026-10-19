import * as vscode from 'vscode';

export const CREATE_PROJECT_COMMAND_ID = 'devlaunch.createProject';
export const CREATE_PROJECT_INFO_MESSAGE =
	'DevLaunch is ready. Project generation will be available in the next development phase.';

/**
 * Registers the createProject command with VS Code.
 * @returns A vscode.Disposable for the registered command.
 */
export function registerCreateProjectCommand(): vscode.Disposable {
	return vscode.commands.registerCommand(CREATE_PROJECT_COMMAND_ID, () => {
		void vscode.window.showInformationMessage(CREATE_PROJECT_INFO_MESSAGE);
	});
}

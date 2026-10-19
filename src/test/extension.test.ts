import * as assert from 'assert';
import * as vscode from 'vscode';
import { CREATE_PROJECT_COMMAND_ID } from '../commands/createProject';

suite('DevLaunch Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension activates successfully', async () => {
		const extension = vscode.extensions.all.find(
			ext => ext.packageJSON?.name === 'devlaunch'
		);
		assert.ok(extension, 'DevLaunch extension should be installed and discovered');

		if (!extension.isActive) {
			await extension.activate();
		}
		assert.strictEqual(extension.isActive, true, 'DevLaunch extension should be active');
	});

	test('Command devlaunch.createProject is registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes(CREATE_PROJECT_COMMAND_ID),
			`Command ${CREATE_PROJECT_COMMAND_ID} should be registered in VS Code`
		);
	});

	test('Executing devlaunch.createProject does not throw an error', async () => {
		await assert.doesNotReject(async () => {
			await vscode.commands.executeCommand(CREATE_PROJECT_COMMAND_ID);
		}, 'Executing devlaunch.createProject should resolve without throwing');
	});
});


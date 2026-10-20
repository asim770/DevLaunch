import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CREATE_PROJECT_COMMAND_ID, PROJECT_TYPE_CHOICES } from '../commands/createProject';

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

  test('Executing devlaunch.createProject with cancellation resolves cleanly without error', async () => {
    const originalShowInputBox = vscode.window.showInputBox;
    try {
      // Simulate user dismissing input box
      (vscode.window as any).showInputBox = async () => undefined;

      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand(CREATE_PROJECT_COMMAND_ID);
      }, 'Executing devlaunch.createProject with cancellation should resolve cleanly');
    } finally {
      (vscode.window as any).showInputBox = originalShowInputBox;
    }
  });

  test('Executing devlaunch.createProject end-to-end via command dispatcher', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'devlaunch-cmd-test-'));
    const testProjectName = 'command-dispatched-project';
    const originalShowInputBox = vscode.window.showInputBox;
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowOpenDialog = vscode.window.showOpenDialog;
    const originalShowInfo = vscode.window.showInformationMessage;

    try {
      (vscode.window as any).showInputBox = async () => testProjectName;
      (vscode.window as any).showQuickPick = async () => PROJECT_TYPE_CHOICES[1]; // React Frontend
      (vscode.window as any).showOpenDialog = async () => [vscode.Uri.file(tempDir)];
      (vscode.window as any).showInformationMessage = async () => undefined;

      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand(CREATE_PROJECT_COMMAND_ID);
      });

      // Verify the generated frontend project exists
      const expectedFrontendPath = path.join(tempDir, testProjectName, 'frontend');
      assert.ok(
        fs.existsSync(expectedFrontendPath),
        `Expected generated project directory at ${expectedFrontendPath}`
      );
      assert.ok(
        fs.existsSync(path.join(expectedFrontendPath, 'package.json')),
        'Expected package.json in generated frontend project'
      );
    } finally {
      (vscode.window as any).showInputBox = originalShowInputBox;
      (vscode.window as any).showQuickPick = originalShowQuickPick;
      (vscode.window as any).showOpenDialog = originalShowOpenDialog;
      (vscode.window as any).showInformationMessage = originalShowInfo;

      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    }
  });

  test('Manifest declares devlaunch.createProject with title DevLaunch: Create Full-Stack Project', () => {
    const extension = vscode.extensions.all.find(ext => ext.packageJSON?.name === 'devlaunch');
    assert.ok(extension, 'Extension devlaunch should be discovered');
    const commands = extension.packageJSON?.contributes?.commands;
    assert.ok(Array.isArray(commands), 'contributes.commands should be an array');
    const cmd = commands.find((c: any) => c.command === CREATE_PROJECT_COMMAND_ID);
    assert.ok(cmd, `Command ${CREATE_PROJECT_COMMAND_ID} should be in contributes.commands`);
    assert.strictEqual(
      cmd.title,
      'DevLaunch: Create Full-Stack Project',
      'Command title must match manifest declaration'
    );
  });

  test('Extension templates directory exists and contains frontend and backend templates', () => {
    const extension = vscode.extensions.all.find(ext => ext.packageJSON?.name === 'devlaunch');
    assert.ok(extension, 'Extension devlaunch should be discovered');
    const templatesRoot = path.join(extension.extensionUri.fsPath, 'templates');
    assert.ok(fs.existsSync(templatesRoot), `Templates root should exist at ${templatesRoot}`);
    assert.ok(fs.existsSync(path.join(templatesRoot, 'frontend')), 'templates/frontend should exist');
    assert.ok(fs.existsSync(path.join(templatesRoot, 'backend')), 'templates/backend should exist');
  });

  test('Command dispatcher handles generation collision gracefully by presenting error message', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'devlaunch-collision-test-'));
    const conflictName = 'conflict-app';
    const conflictPath = path.join(tempDir, conflictName);
    await fs.promises.mkdir(conflictPath);

    const originalShowInputBox = vscode.window.showInputBox;
    const originalShowQuickPick = vscode.window.showQuickPick;
    const originalShowOpenDialog = vscode.window.showOpenDialog;
    const originalShowError = vscode.window.showErrorMessage;

    let errorReported: string | undefined;

    try {
      (vscode.window as any).showInputBox = async () => conflictName;
      (vscode.window as any).showQuickPick = async () => PROJECT_TYPE_CHOICES[0];
      (vscode.window as any).showOpenDialog = async () => [vscode.Uri.file(tempDir)];
      (vscode.window as any).showErrorMessage = async (msg: string) => {
        errorReported = msg;
        return undefined;
      };

      await assert.doesNotReject(async () => {
        await vscode.commands.executeCommand(CREATE_PROJECT_COMMAND_ID);
      });

      assert.ok(errorReported, 'Expected error message to be displayed to user');
      assert.match(errorReported!, /already exists/i, 'Error message should indicate directory already exists');
    } finally {
      (vscode.window as any).showInputBox = originalShowInputBox;
      (vscode.window as any).showQuickPick = originalShowQuickPick;
      (vscode.window as any).showOpenDialog = originalShowOpenDialog;
      (vscode.window as any).showErrorMessage = originalShowError;

      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    }
  });
});

import * as vscode from 'vscode';
import * as path from 'path';
import {
  generateProject,
  validateProjectName,
  ProjectType,
  GenerationResult,
} from '../generator/projectGenerator';

export const CREATE_PROJECT_COMMAND_ID = 'devlaunch.createProject';

export interface ProjectTypeQuickPickItem extends vscode.QuickPickItem {
  type: ProjectType;
}

export const PROJECT_TYPE_CHOICES: ProjectTypeQuickPickItem[] = [
  {
    label: '$(layers) Full-Stack (React + Express)',
    description: 'Frontend and Backend templates',
    detail: 'React 18 + Vite + Tailwind CSS frontend and Express 5 + TypeScript + MongoDB backend',
    type: 'fullstack',
  },
  {
    label: '$(browser) React Frontend',
    description: 'Frontend only',
    detail: 'React 18 + Vite + TypeScript + Tailwind CSS starter',
    type: 'frontend',
  },
  {
    label: '$(server) Express Backend',
    description: 'Backend only',
    detail: 'Express 5 + TypeScript + MongoDB/Mongoose authentication starter',
    type: 'backend',
  },
];

export interface CreateProjectUi {
  showInputBox: typeof vscode.window.showInputBox;
  showQuickPick: (
    items: ProjectTypeQuickPickItem[],
    options?: vscode.QuickPickOptions
  ) => Thenable<ProjectTypeQuickPickItem | undefined>;
  showOpenDialog: typeof vscode.window.showOpenDialog;
  showInformationMessage: typeof vscode.window.showInformationMessage;
  showErrorMessage: typeof vscode.window.showErrorMessage;
  withProgress: typeof vscode.window.withProgress;
  executeCommand: typeof vscode.commands.executeCommand;
  outputChannel?: vscode.OutputChannel;
}

let defaultOutputChannel: vscode.OutputChannel | undefined;

/**
 * Returns or creates the singleton OutputChannel for DevLaunch logs.
 */
function getOutputChannel(): vscode.OutputChannel {
  if (!defaultOutputChannel) {
    defaultOutputChannel = vscode.window.createOutputChannel('DevLaunch');
  }
  return defaultOutputChannel;
}

/**
 * Executes the interactive multi-step project creation workflow.
 * Can be called with mock UI dependencies for testing.
 */
export async function executeCreateProject(
  templatesRoot: string,
  ui: CreateProjectUi
): Promise<GenerationResult | undefined> {
  // Step 1: Prompt for Project Name
  const projectName = await ui.showInputBox({
    title: 'DevLaunch: Create Project (Step 1 of 3)',
    prompt: 'Enter a name for your new project',
    placeHolder: 'my-devlaunch-app',
    validateInput: validateProjectName,
    ignoreFocusOut: true,
  });

  if (!projectName) {
    // User cancelled
    return undefined;
  }

  // Step 2: Prompt for Project Type
  const selectedChoice = await ui.showQuickPick(PROJECT_TYPE_CHOICES, {
    title: 'DevLaunch: Create Project (Step 2 of 3)',
    placeHolder: 'Select the project template to generate',
    ignoreFocusOut: true,
  });

  if (!selectedChoice) {
    // User cancelled
    return undefined;
  }

  // Step 3: Prompt for Destination Directory
  const destinationUris = await ui.showOpenDialog({
    title: 'DevLaunch: Create Project (Step 3 of 3) - Select Parent Directory',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Destination Folder',
  });

  if (!destinationUris || destinationUris.length === 0) {
    // User cancelled
    return undefined;
  }

  const destinationDirectory = destinationUris[0].fsPath;

  // Step 4: Generate Project with Progress Indicator
  let result: GenerationResult | undefined;

  try {
    await ui.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `DevLaunch: Generating project "${projectName}"...`,
        cancellable: false,
      },
      async () => {
        result = await generateProject({
          projectName,
          projectType: selectedChoice.type,
          destinationDirectory,
          templatesRoot,
        });
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    const errorMessage = error?.message || String(err);
    await ui.showErrorMessage(`DevLaunch: Failed to create project: ${errorMessage}`);
    return undefined;
  }

  if (!result || !result.success) {
    return undefined;
  }

  // Step 5: Report Success & Display Next Steps
  const outputChannel = ui.outputChannel || getOutputChannel();
  outputChannel.appendLine('====================================================');
  outputChannel.appendLine('DevLaunch: Project Created Successfully!');
  outputChannel.appendLine(`Name:     ${projectName}`);
  outputChannel.appendLine(`Type:     ${result.projectType}`);
  outputChannel.appendLine(`Location: ${result.projectPath}`);
  outputChannel.appendLine('====================================================');
  outputChannel.appendLine('Next Steps:');
  for (const step of result.instructions) {
    outputChannel.appendLine(step ? `  ${step}` : '');
  }
  outputChannel.appendLine('====================================================\n');
  outputChannel.show(true);

  const openFolderAction = 'Open Folder';
  const action = await ui.showInformationMessage(
    `DevLaunch project "${projectName}" created successfully at ${result.projectPath}`,
    openFolderAction
  );

  if (action === openFolderAction) {
    await ui.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(result.projectPath),
      { forceNewWindow: false }
    );
  }

  return result;
}

/**
 * Registers the createProject command with VS Code.
 * @param templatesRoot Optional path to the templates directory; defaults to extension root templates.
 * @param uiOverrides Optional UI overrides for testing.
 * @returns A vscode.Disposable for the registered command.
 */
export function registerCreateProjectCommand(
  templatesRoot?: string,
  uiOverrides?: Partial<CreateProjectUi>
): vscode.Disposable {
  const resolvedTemplatesRoot =
    templatesRoot || path.resolve(__dirname, '..', '..', 'templates');

  return vscode.commands.registerCommand(CREATE_PROJECT_COMMAND_ID, async () => {
    const ui: CreateProjectUi = {
      showInputBox: vscode.window.showInputBox,
      showQuickPick: vscode.window.showQuickPick as (
        items: ProjectTypeQuickPickItem[],
        options?: vscode.QuickPickOptions
      ) => Thenable<ProjectTypeQuickPickItem | undefined>,
      showOpenDialog: vscode.window.showOpenDialog,
      showInformationMessage: vscode.window.showInformationMessage,
      showErrorMessage: vscode.window.showErrorMessage,
      withProgress: vscode.window.withProgress,
      executeCommand: vscode.commands.executeCommand,
      outputChannel: getOutputChannel(),
      ...uiOverrides,
    };

    return executeCreateProject(resolvedTemplatesRoot, ui);
  });
}

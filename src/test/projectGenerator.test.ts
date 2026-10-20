import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import {
  validateProjectName,
  shouldIgnoreEntry,
  generateProject,
  getNextStepsInstructions,
} from '../generator/projectGenerator';
import {
  executeCreateProject,
  CreateProjectUi,
  PROJECT_TYPE_CHOICES,
} from '../commands/createProject';

suite('Project Generator Module Tests', () => {
  let tempBaseDir: string;
  let mockTemplatesDir: string;
  let mockFrontendDir: string;
  let mockBackendDir: string;
  let destDir: string;

  suiteSetup(async () => {
    tempBaseDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'devlaunch-test-'));
    mockTemplatesDir = path.join(tempBaseDir, 'templates');
    mockFrontendDir = path.join(mockTemplatesDir, 'frontend');
    mockBackendDir = path.join(mockTemplatesDir, 'backend');
    destDir = path.join(tempBaseDir, 'dest');

    await fs.promises.mkdir(mockFrontendDir, { recursive: true });
    await fs.promises.mkdir(mockBackendDir, { recursive: true });
    await fs.promises.mkdir(destDir, { recursive: true });

    // Populate mock frontend template
    await fs.promises.mkdir(path.join(mockFrontendDir, 'src'), { recursive: true });
    await fs.promises.mkdir(path.join(mockFrontendDir, 'dist'), { recursive: true });
    await fs.promises.mkdir(path.join(mockFrontendDir, 'node_modules', 'pkg'), { recursive: true });

    await fs.promises.writeFile(path.join(mockFrontendDir, 'package.json'), '{"name":"fe"}');
    await fs.promises.writeFile(path.join(mockFrontendDir, '.env.example'), 'VITE_API=http://localhost:5000');
    await fs.promises.writeFile(path.join(mockFrontendDir, '.env'), 'SECRET=real_frontend_secret');
    await fs.promises.writeFile(path.join(mockFrontendDir, '.env.local'), 'SECRET=local_override');
    await fs.promises.writeFile(path.join(mockFrontendDir, 'npm-debug.log'), 'error logs');
    await fs.promises.writeFile(path.join(mockFrontendDir, '.DS_Store'), 'darwin metadata');
    await fs.promises.writeFile(path.join(mockFrontendDir, 'dist', 'bundle.js'), 'bundle output');
    await fs.promises.writeFile(path.join(mockFrontendDir, 'node_modules', 'pkg', 'index.js'), 'code');
    await fs.promises.writeFile(path.join(mockFrontendDir, 'src', 'App.tsx'), 'export const App = () => null;');

    // Populate mock backend template
    await fs.promises.mkdir(path.join(mockBackendDir, 'src'), { recursive: true });
    await fs.promises.mkdir(path.join(mockBackendDir, 'dist'), { recursive: true });
    await fs.promises.mkdir(path.join(mockBackendDir, 'node_modules', 'pkg'), { recursive: true });

    await fs.promises.writeFile(path.join(mockBackendDir, 'package.json'), '{"name":"be"}');
    await fs.promises.writeFile(path.join(mockBackendDir, '.env.example'), 'PORT=5000\nJWT_SECRET=xyz');
    await fs.promises.writeFile(path.join(mockBackendDir, '.env'), 'JWT_SECRET=super_secret_value');
    await fs.promises.writeFile(path.join(mockBackendDir, '.env.production'), 'JWT_SECRET=prod_secret');
    await fs.promises.writeFile(path.join(mockBackendDir, 'dist', 'server.js'), 'compiled code');
    await fs.promises.writeFile(path.join(mockBackendDir, 'node_modules', 'pkg', 'index.js'), 'dep code');
    await fs.promises.writeFile(path.join(mockBackendDir, 'src', 'server.ts'), 'console.log("running");');

    // Create a symlink in frontend to verify symlinks are ignored
    try {
      await fs.promises.symlink(
        path.join(mockFrontendDir, 'package.json'),
        path.join(mockFrontendDir, 'symlinked-package.json')
      );
    } catch {
      // Symlinks may require elevated privileges on some platforms; ignore if unsupported
    }
  });

  suiteTeardown(async () => {
    try {
      await fs.promises.rm(tempBaseDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  suite('1. Project Name Validation (validateProjectName)', () => {
    test('accepts valid project names on macOS, Linux, and Windows', () => {
      assert.strictEqual(validateProjectName('my-app'), null);
      assert.strictEqual(validateProjectName('app123'), null);
      assert.strictEqual(validateProjectName('SampleProject'), null);
      assert.strictEqual(validateProjectName('dev-launch_pro-2'), null);
      assert.strictEqual(validateProjectName('constant'), null);
      assert.strictEqual(validateProjectName('contact-form'), null);
      assert.strictEqual(validateProjectName('control-panel'), null);
      assert.strictEqual(validateProjectName('null-handler'), null);
      assert.strictEqual(validateProjectName('auxiliary-tool'), null);
      assert.strictEqual(validateProjectName('com10'), null);
      assert.strictEqual(validateProjectName('lpt0'), null);
      assert.strictEqual(validateProjectName('frontend-app.v2'), null);
    });

    test('rejects empty or whitespace-only names', () => {
      assert.ok(validateProjectName(''));
      assert.ok(validateProjectName('   '));
    });

    test('rejects relative navigation names "." and ".."', () => {
      assert.ok(validateProjectName('.'));
      assert.ok(validateProjectName('..'));
    });

    test('rejects names with path separators', () => {
      assert.ok(validateProjectName('foo/bar'));
      assert.ok(validateProjectName('foo\\bar'));
      assert.ok(validateProjectName('/root'));
      assert.ok(validateProjectName('c:\\app'));
    });

    test('rejects invalid filesystem characters', () => {
      assert.ok(validateProjectName('app:one'));
      assert.ok(validateProjectName('app<one>'));
      assert.ok(validateProjectName('app"one'));
      assert.ok(validateProjectName('app|one'));
      assert.ok(validateProjectName('app?one'));
      assert.ok(validateProjectName('app*one'));
    });

    test('rejects Windows reserved filenames and extensions/space variants', () => {
      const reservedVariants = [
        'con',
        'prn',
        'aux',
        'nul',
        'com1',
        'com9',
        'lpt1',
        'lpt9',
        'CON.txt',
        'NUL ',
        'CON .',
        'CON. ',
        'aux.tar.gz',
        'prn.log',
        'com1.json',
        'lpt2.txt',
        'aux.c',
      ];

      for (const variant of reservedVariants) {
        const error = validateProjectName(variant);
        assert.ok(error, `Expected "${variant}" to be rejected as a reserved system name`);
        assert.match(
          error!,
          /reserved/i,
          `Expected rejection message for "${variant}" to mention "reserved"`
        );
      }
    });

    test('rejects names with leading/trailing spaces or trailing period', () => {
      assert.ok(validateProjectName(' my-app'));
      assert.ok(validateProjectName('my-app '));
      assert.ok(validateProjectName('my-app.'));
    });
  });

  suite('2. Template Entry Exclusion (shouldIgnoreEntry)', () => {
    test('excludes build and dependency folders', () => {
      assert.strictEqual(shouldIgnoreEntry('node_modules', false), true);
      assert.strictEqual(shouldIgnoreEntry('dist', false), true);
      assert.strictEqual(shouldIgnoreEntry('out', false), true);
      assert.strictEqual(shouldIgnoreEntry('.git', false), true);
      assert.strictEqual(shouldIgnoreEntry('.vscode-test', false), true);
      assert.strictEqual(shouldIgnoreEntry('.DS_Store', false), true);
      assert.strictEqual(shouldIgnoreEntry('coverage', false), true);
    });

    test('excludes symbolic links', () => {
      assert.strictEqual(shouldIgnoreEntry('my-file.ts', true), true);
      assert.strictEqual(shouldIgnoreEntry('package.json', true), true);
    });

    test('excludes real .env files while preserving .env.example', () => {
      assert.strictEqual(shouldIgnoreEntry('.env', false), true);
      assert.strictEqual(shouldIgnoreEntry('.env.local', false), true);
      assert.strictEqual(shouldIgnoreEntry('.env.development', false), true);
      assert.strictEqual(shouldIgnoreEntry('.env.production', false), true);
      assert.strictEqual(shouldIgnoreEntry('.env.example', false), false);
    });

    test('excludes log files', () => {
      assert.strictEqual(shouldIgnoreEntry('app.log', false), true);
      assert.strictEqual(shouldIgnoreEntry('npm-debug.log', false), true);
      assert.strictEqual(shouldIgnoreEntry('yarn-debug.log', false), true);
    });

    test('allows standard project files', () => {
      assert.strictEqual(shouldIgnoreEntry('package.json', false), false);
      assert.strictEqual(shouldIgnoreEntry('tsconfig.json', false), false);
      assert.strictEqual(shouldIgnoreEntry('server.ts', false), false);
      assert.strictEqual(shouldIgnoreEntry('.gitignore', false), false);
    });
  });

  suite('3. Project Generation Logic (generateProject)', () => {
    test('generates frontend-only project cleanly', async () => {
      const projectName = 'test-frontend-only';
      const result = await generateProject({
        projectName,
        projectType: 'frontend',
        destinationDirectory: destDir,
        templatesRoot: mockTemplatesDir,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectType, 'frontend');
      assert.ok(result.frontendPath);
      assert.strictEqual(result.backendPath, undefined);

      // Verify files copied to frontend
      const feDir = result.frontendPath!;
      assert.ok(fs.existsSync(path.join(feDir, 'package.json')));
      assert.ok(fs.existsSync(path.join(feDir, '.env.example')));
      assert.ok(fs.existsSync(path.join(feDir, 'src', 'App.tsx')));

      // Verify ignored files are absent
      assert.strictEqual(fs.existsSync(path.join(feDir, '.env')), false);
      assert.strictEqual(fs.existsSync(path.join(feDir, '.env.local')), false);
      assert.strictEqual(fs.existsSync(path.join(feDir, 'dist')), false);
      assert.strictEqual(fs.existsSync(path.join(feDir, 'node_modules')), false);
      assert.strictEqual(fs.existsSync(path.join(feDir, '.DS_Store')), false);
      assert.strictEqual(fs.existsSync(path.join(feDir, 'npm-debug.log')), false);
      assert.strictEqual(fs.existsSync(path.join(feDir, 'symlinked-package.json')), false);

      // Verify backend was not created
      assert.strictEqual(fs.existsSync(path.join(result.projectPath, 'backend')), false);

      // Verify next steps instructions
      assert.ok(result.instructions.some(i => i.includes('frontend')));
    });

    test('generates backend-only project cleanly', async () => {
      const projectName = 'test-backend-only';
      const result = await generateProject({
        projectName,
        projectType: 'backend',
        destinationDirectory: destDir,
        templatesRoot: mockTemplatesDir,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectType, 'backend');
      assert.ok(result.backendPath);
      assert.strictEqual(result.frontendPath, undefined);

      const beDir = result.backendPath!;
      assert.ok(fs.existsSync(path.join(beDir, 'package.json')));
      assert.ok(fs.existsSync(path.join(beDir, '.env.example')));
      assert.ok(fs.existsSync(path.join(beDir, 'src', 'server.ts')));

      assert.strictEqual(fs.existsSync(path.join(beDir, '.env')), false);
      assert.strictEqual(fs.existsSync(path.join(beDir, '.env.production')), false);
      assert.strictEqual(fs.existsSync(path.join(beDir, 'dist')), false);
      assert.strictEqual(fs.existsSync(path.join(beDir, 'node_modules')), false);

      assert.strictEqual(fs.existsSync(path.join(result.projectPath, 'frontend')), false);
    });

    test('generates full-stack project with both frontend and backend', async () => {
      const projectName = 'test-fullstack-app';
      const result = await generateProject({
        projectName,
        projectType: 'fullstack',
        destinationDirectory: destDir,
        templatesRoot: mockTemplatesDir,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectType, 'fullstack');
      assert.ok(result.frontendPath);
      assert.ok(result.backendPath);

      assert.ok(fs.existsSync(path.join(result.frontendPath!, 'src', 'App.tsx')));
      assert.ok(fs.existsSync(path.join(result.backendPath!, 'src', 'server.ts')));

      // Next steps should reference both
      const instructionText = result.instructions.join('\n');
      assert.ok(instructionText.includes('frontend'));
      assert.ok(instructionText.includes('backend'));
    });

    test('refuses to overwrite an existing directory (even if empty) and leaves it untouched', async () => {
      const emptyDirName = 'existing-empty-project';
      const emptyDirPath = path.join(destDir, emptyDirName);
      await fs.promises.mkdir(emptyDirPath);

      await assert.rejects(
        async () => {
          await generateProject({
            projectName: emptyDirName,
            projectType: 'fullstack',
            destinationDirectory: destDir,
            templatesRoot: mockTemplatesDir,
          });
        },
        /already exists/
      );

      // Verify the empty directory was left untouched and not populated
      assert.ok(fs.existsSync(emptyDirPath));
      const contents = await fs.promises.readdir(emptyDirPath);
      assert.strictEqual(contents.length, 0, 'Pre-existing empty directory should remain empty');
    });

    test('refuses to overwrite an existing project directory and leaves it untouched', async () => {
      const existingName = 'existing-conflict-project';
      const existingPath = path.join(destDir, existingName);
      await fs.promises.mkdir(existingPath);
      const sentinelFile = path.join(existingPath, 'important_user_work.txt');
      await fs.promises.writeFile(sentinelFile, 'do not delete');

      await assert.rejects(
        async () => {
          await generateProject({
            projectName: existingName,
            projectType: 'fullstack',
            destinationDirectory: destDir,
            templatesRoot: mockTemplatesDir,
          });
        },
        /already exists/
      );

      // Verify the sentinel file is completely intact
      assert.ok(fs.existsSync(sentinelFile));
      const content = await fs.promises.readFile(sentinelFile, 'utf8');
      assert.strictEqual(content, 'do not delete');
      assert.strictEqual(fs.existsSync(path.join(existingPath, 'frontend')), false);
      assert.strictEqual(fs.existsSync(path.join(existingPath, 'backend')), false);
    });

    test('cleans up newly created directory on copy failure without leaving partial output or affecting siblings', async () => {
      const siblingDir = path.join(destDir, 'unrelated-sibling');
      await fs.promises.mkdir(siblingDir);
      const siblingFile = path.join(siblingDir, 'sibling-file.txt');
      await fs.promises.writeFile(siblingFile, 'sibling content');

      const failedName = 'test-fail-cleanup';
      const targetPath = path.join(destDir, failedName);

      await assert.rejects(
        async () => {
          await generateProject({
            projectName: failedName,
            projectType: 'frontend',
            destinationDirectory: destDir,
            templatesRoot: '/non/existent/templates/dir',
          });
        },
        /Frontend template directory not found/
      );

      // Target path should NOT exist on disk
      assert.strictEqual(fs.existsSync(targetPath), false);

      // Sibling directory must remain completely intact
      assert.ok(fs.existsSync(siblingFile));
      const siblingContent = await fs.promises.readFile(siblingFile, 'utf8');
      assert.strictEqual(siblingContent, 'sibling content');
    });

    test('rejects non-existent destination directory', async () => {
      await assert.rejects(
        async () => {
          await generateProject({
            projectName: 'valid-name',
            projectType: 'frontend',
            destinationDirectory: '/non/existent/destination/path',
            templatesRoot: mockTemplatesDir,
          });
        },
        /does not exist/
      );
    });
  });

  suite('4. Next Steps Instruction Formatting (getNextStepsInstructions)', () => {
    test('formats instructions for frontend, backend, and fullstack', () => {
      const fe = getNextStepsInstructions('demo-app', 'frontend');
      assert.ok(fe.some(step => step.includes('cd "demo-app/frontend"') || step.includes('cd "demo-app\\frontend"')));
      assert.ok(fe.includes('npm install'));
      assert.ok(fe.includes('npm run dev'));

      const be = getNextStepsInstructions('demo-app', 'backend');
      assert.ok(be.some(step => step.includes('cd "demo-app/backend"') || step.includes('cd "demo-app\\backend"')));
      assert.ok(fe.includes('npm install'));
      assert.ok(fe.includes('npm run dev'));

      const fsInst = getNextStepsInstructions('demo-app', 'fullstack');
      assert.ok(fsInst.some(step => step.toLowerCase().includes('open two terminals')));
      assert.ok(fsInst.some(step => step.includes('Terminal 1 (Frontend)')));
      assert.ok(fsInst.some(step => step.includes('Terminal 2 (Backend)')));
      // Ensure long running servers are NOT chained with &&
      assert.strictEqual(fsInst.some(step => step.includes('&& npm run dev')), false);
      assert.strictEqual(fsInst.some(step => step.includes('npm run dev &&')), false);
    });

    test('quotes directory paths with spaces safely', () => {
      const spaced = getNextStepsInstructions('my cool app', 'fullstack');
      const text = spaced.join('\n');
      assert.ok(
        text.includes('"my cool app/frontend"') || text.includes('"my cool app\\frontend"'),
        'Frontend path with spaces should be quoted'
      );
      assert.ok(
        text.includes('"my cool app/backend"') || text.includes('"my cool app\\backend"'),
        'Backend path with spaces should be quoted'
      );
    });
  });

  suite('5. Interactive Workflow & Cancellation (executeCreateProject)', () => {
    function createMockUi(overrides: Partial<CreateProjectUi> = {}): {
      ui: CreateProjectUi;
      outputLines: string[];
      infoMessages: string[];
      errorMessages: string[];
    } {
      const outputLines: string[] = [];
      const infoMessages: string[] = [];
      const errorMessages: string[] = [];

      const mockOutputChannel: any = {
        appendLine: (line: string) => outputLines.push(line),
        show: () => {},
        dispose: () => {},
      };

      const ui: CreateProjectUi = {
        showInputBox: async () => 'test-workflow-project',
        showQuickPick: async () => PROJECT_TYPE_CHOICES[0],
        showOpenDialog: async () => [vscode.Uri.file(destDir)],
        showInformationMessage: async (msg: string) => {
          infoMessages.push(msg);
          return undefined;
        },
        showErrorMessage: async (msg: string) => {
          errorMessages.push(msg);
          return undefined;
        },
        withProgress: async (_options, task) => {
          return task({ report: () => {} }, new vscode.CancellationTokenSource().token);
        },
        executeCommand: (async () => undefined) as typeof vscode.commands.executeCommand,
        outputChannel: mockOutputChannel,
        ...overrides,
      };

      return { ui, outputLines, infoMessages, errorMessages };
    }

    test('handles cancellation at project name input box', async () => {
      const { ui } = createMockUi({
        showInputBox: async () => undefined, // User cancelled
      });

      const result = await executeCreateProject(mockTemplatesDir, ui);
      assert.strictEqual(result, undefined);
    });

    test('handles cancellation at project type quick pick', async () => {
      const { ui } = createMockUi({
        showQuickPick: async () => undefined, // User cancelled
      });

      const result = await executeCreateProject(mockTemplatesDir, ui);
      assert.strictEqual(result, undefined);
    });

    test('handles cancellation at destination open dialog', async () => {
      const { ui } = createMockUi({
        showOpenDialog: async () => undefined, // User cancelled
      });

      const result = await executeCreateProject(mockTemplatesDir, ui);
      assert.strictEqual(result, undefined);
    });

    test('completes full generation flow with mock UI and displays next steps', async () => {
      const projectName = 'workflow-complete-test';
      const { ui, outputLines, infoMessages } = createMockUi({
        showInputBox: async () => projectName,
        showQuickPick: async () => PROJECT_TYPE_CHOICES[0], // full-stack
        showOpenDialog: async () => [vscode.Uri.file(destDir)],
      });

      const result = await executeCreateProject(mockTemplatesDir, ui);

      assert.ok(result);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectType, 'fullstack');
      assert.ok(fs.existsSync(path.join(destDir, projectName, 'frontend', 'package.json')));
      assert.ok(fs.existsSync(path.join(destDir, projectName, 'backend', 'package.json')));

      // Check output channel was written to
      assert.ok(outputLines.some(l => l.includes('Project Created Successfully!')));
      assert.ok(outputLines.some(l => l.includes('Next Steps:')));

      // Check info message shown
      assert.ok(infoMessages.some(m => m.includes(projectName)));
    });

    test('handles generation failure gracefully by showing error message', async () => {
      const { ui, errorMessages } = createMockUi({
        showInputBox: async () => 'error-handled-project',
        showOpenDialog: async () => [vscode.Uri.file('/non/existent/path/for/failure')],
      });

      const result = await executeCreateProject(mockTemplatesDir, ui);

      assert.strictEqual(result, undefined);
      assert.ok(errorMessages.length > 0);
      assert.ok(errorMessages[0].includes('Failed to create project'));
    });
  });
});

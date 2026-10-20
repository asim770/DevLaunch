import * as fs from 'fs';
import * as path from 'path';

export type ProjectType = 'frontend' | 'backend' | 'fullstack';

export interface GenerateProjectOptions {
  projectName: string;
  projectType: ProjectType;
  destinationDirectory: string;
  templatesRoot: string;
}

export interface GenerationResult {
  success: boolean;
  projectPath: string;
  frontendPath?: string;
  backendPath?: string;
  projectType: ProjectType;
  instructions: string[];
}

/**
 * Validates a project name according to cross-platform filesystem constraints.
 * Returns null if valid, or a descriptive error message if invalid.
 */
export function validateProjectName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Project name cannot be empty.';
  }

  const trimmed = name.trim();

  if (trimmed === '.' || trimmed === '..') {
    return 'Project name cannot be "." or "..".';
  }

  if (/[/\\]/.test(trimmed)) {
    return 'Project name cannot contain path separators ("/" or "\\").';
  }

  // Cross-platform invalid characters: < > : " / \ | ? * and ASCII control characters (0-31)
  if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmed)) {
    return 'Project name contains invalid characters. Avoid characters such as <, >, :, ", |, ?, *';
  }

  // Windows reserved system filenames (con, prn, aux, nul, com1-9, lpt1-9).
  // On Windows, these devices cannot be used even when followed by extensions or
  // trailing spaces/periods (e.g. "CON.txt", "NUL ", "CON .", "aux.tar.gz").
  const baseStem = trimmed.split('.')[0].trimEnd();
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(baseStem)) {
    return `"${trimmed}" is a reserved system name. Please choose a different name.`;
  }

  if (name !== trimmed) {
    return 'Project name cannot start or end with whitespace.';
  }

  if (trimmed.endsWith('.')) {
    return 'Project name cannot end with a period.';
  }

  return null;
}

/**
 * Ignored directories and files that should not be copied from templates.
 */
export const IGNORED_ENTRIES = new Set([
  'node_modules',
  'dist',
  'out',
  '.git',
  '.vscode',
  '.vscode-test',
  '.DS_Store',
  'Thumbs.db',
  'coverage',
  '.turbo',
  '.cache',
]);

/**
 * Determines whether a file or directory entry should be excluded during template copying.
 */
export function shouldIgnoreEntry(name: string, isSymbolicLink: boolean): boolean {
  // Never copy or follow symbolic links
  if (isSymbolicLink) {
    return true;
  }

  if (IGNORED_ENTRIES.has(name)) {
    return true;
  }

  // Never copy real .env or .env.local files; copy .env.example only
  if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example')) {
    return true;
  }

  // Exclude log files
  if (
    name.endsWith('.log') ||
    name.startsWith('npm-debug.log') ||
    name.startsWith('yarn-debug.log') ||
    name.startsWith('pnpm-debug.log')
  ) {
    return true;
  }

  return false;
}

/**
 * Recursively copies a directory while respecting ignore rules and avoiding symlinks.
 */
export async function copyDirectory(srcDir: string, destDir: string): Promise<void> {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const isSymlink = entry.isSymbolicLink();
    if (shouldIgnoreEntry(entry.name, isSymlink)) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Wraps a filesystem path in double quotes, escaping existing double quotes.
 */
function quotePath(p: string): string {
  return `"${p.replace(/"/g, '\\"')}"`;
}

/**
 * Formats actionable next-steps instructions based on project type.
 */
export function getNextStepsInstructions(projectName: string, projectType: ProjectType): string[] {
  switch (projectType) {
    case 'frontend': {
      const feDir = path.join(projectName, 'frontend');
      return [
        `cd ${quotePath(feDir)}`,
        'npm install',
        'npm run dev',
      ];
    }
    case 'backend': {
      const beDir = path.join(projectName, 'backend');
      return [
        `cd ${quotePath(beDir)}`,
        'npm install',
        'npm run dev',
      ];
    }
    case 'fullstack': {
      const feDir = path.join(projectName, 'frontend');
      const beDir = path.join(projectName, 'backend');
      return [
        'Open two terminals to run the frontend and backend servers separately:',
        '',
        'Terminal 1 (Frontend):',
        `  cd ${quotePath(feDir)}`,
        '  npm install',
        '  npm run dev',
        '',
        'Terminal 2 (Backend):',
        `  cd ${quotePath(beDir)}`,
        '  npm install',
        '  npm run dev',
      ];
    }
  }
}

/**
 * Generates a new DevLaunch project by copying template files to the target destination.
 */
export async function generateProject(options: GenerateProjectOptions): Promise<GenerationResult> {
  const { projectName, projectType, destinationDirectory, templatesRoot } = options;

  // 1. Validate project name
  const validationError = validateProjectName(projectName);
  if (validationError) {
    throw new Error(`Invalid project name "${projectName}": ${validationError}`);
  }

  // 2. Validate destination directory exists and is a directory
  try {
    const destStat = await fs.promises.stat(destinationDirectory);
    if (!destStat.isDirectory()) {
      throw new Error(`Destination path "${destinationDirectory}" is not a directory.`);
    }
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      throw new Error(`Destination directory "${destinationDirectory}" does not exist.`);
    }
    throw err;
  }

  // 3. Validate template sources before touching the destination filesystem
  const frontendTemplateSrc = path.join(templatesRoot, 'frontend');
  const backendTemplateSrc = path.join(templatesRoot, 'backend');

  if (projectType === 'frontend' || projectType === 'fullstack') {
    try {
      const stat = await fs.promises.stat(frontendTemplateSrc);
      if (!stat.isDirectory()) {
        throw new Error(`Frontend template at "${frontendTemplateSrc}" is not a directory.`);
      }
    } catch {
      throw new Error(`Frontend template directory not found at: ${frontendTemplateSrc}`);
    }
  }

  if (projectType === 'backend' || projectType === 'fullstack') {
    try {
      const stat = await fs.promises.stat(backendTemplateSrc);
      if (!stat.isDirectory()) {
        throw new Error(`Backend template at "${backendTemplateSrc}" is not a directory.`);
      }
    } catch {
      throw new Error(`Backend template directory not found at: ${backendTemplateSrc}`);
    }
  }

  // 4. Exclusive directory creation:
  // Using mkdir without recursive flag ensures atomic creation that fails with EEXIST
  // if the target already exists (whether empty or non-empty directory, file, or symlink).
  // This eliminates check-then-act race conditions.
  const targetProjectPath = path.join(destinationDirectory, projectName);
  let createdProjectDir = false;
  let frontendPath: string | undefined;
  let backendPath: string | undefined;

  try {
    try {
      await fs.promises.mkdir(targetProjectPath);
      createdProjectDir = true;
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EEXIST') {
        throw new Error(
          `Project directory "${targetProjectPath}" already exists. Generation aborted to prevent overwriting existing files.`
        );
      }
      throw err;
    }

    if (projectType === 'frontend' || projectType === 'fullstack') {
      frontendPath = path.join(targetProjectPath, 'frontend');
      await copyDirectory(frontendTemplateSrc, frontendPath);
    }

    if (projectType === 'backend' || projectType === 'fullstack') {
      backendPath = path.join(targetProjectPath, 'backend');
      await copyDirectory(backendTemplateSrc, backendPath);
    }
  } catch (err) {
    // Only clean up the project directory if THIS invocation created it exclusively.
    // If the directory already existed or mkdir failed, createdProjectDir is false
    // and we never delete or alter anything.
    if (createdProjectDir) {
      try {
        await fs.promises.rm(targetProjectPath, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error(`Failed to clean up partial directory "${targetProjectPath}":`, cleanupErr);
      }
    }
    throw err;
  }

  const instructions = getNextStepsInstructions(projectName, projectType);

  return {
    success: true,
    projectPath: targetProjectPath,
    frontendPath,
    backendPath,
    projectType,
    instructions,
  };
}

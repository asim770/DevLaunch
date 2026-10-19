# DevLaunch

DevLaunch is a VS Code extension designed to streamline full-stack project initialization.

## Current Status (Chunk 1: Foundation)

This extension is currently in its foundation phase:
- TypeScript-based VS Code extension scaffold.
- Configured build, lint, and test toolchains.
- First registered command: **DevLaunch: Create Full-Stack Project** (`devlaunch.createProject`).

Invoking this command currently presents an informational confirmation:
> *"DevLaunch is ready. Project generation will be available in the next development phase."*

## Available Commands

| Command Title | Command ID | Description |
| :--- | :--- | :--- |
| **DevLaunch: Create Full-Stack Project** | `devlaunch.createProject` | Launches the initial DevLaunch project workflow (readiness notice). |

## Development & Testing

### Prerequisites
- Node.js (>= 20)
- npm

### Build Scripts
- **Compile TypeScript**:
  ```bash
  npm run compile
  ```
- **Watch Mode**:
  ```bash
  npm run watch
  ```
- **Lint Code**:
  ```bash
  npm run lint
  ```
- **Run Tests**:
  ```bash
  npm test
  ```

### Running in Extension Development Host
1. Open the `/Users/asimmaji/Desktop/devLaunch/devlaunch` directory in VS Code.
2. Press `F5` to start debugging with the **Run Extension** configuration.
3. In the Extension Development Host window, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
4. Run `DevLaunch: Create Full-Stack Project`.

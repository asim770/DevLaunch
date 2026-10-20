import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	launchArgs: [
		'--disable-gpu',
		'--disable-updates',
	],
	mocha: {
		timeout: 20000,
	},
});

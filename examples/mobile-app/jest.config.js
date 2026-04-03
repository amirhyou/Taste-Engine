const path = require('path');
// In npm workspaces, jest-expo is hoisted to the root but react-native stays
// local. Add the local node_modules to NODE_PATH so jest-expo's preset can
// resolve react-native/jest-preset correctly.
process.env.NODE_PATH = path.join(__dirname, 'node_modules');
require('module').Module._initPaths();

// Suppress RNTL peer-deps check: react@18 (react-web) is hoisted to workspace
// root while react-test-renderer@19 matches the mobile-app's react@19.1.0.
process.env.RNTL_SKIP_DEPS_CHECK = '1';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Prefer mobile-app's local node_modules so react@19 and react-test-renderer@19
  // are resolved before the hoisted react@18 from react-web workspace.
  modulePaths: [path.join(__dirname, 'node_modules')],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Force jest to resolve react and react-test-renderer from mobile-app's
    // local node_modules (v19) not from the workspace-root hoisted v18.
    '^react$': path.join(__dirname, 'node_modules/react'),
    '^react/(.*)$': path.join(__dirname, 'node_modules/react/$1'),
    '^react-test-renderer$': '<rootDir>/../../node_modules/react-test-renderer',
    '^react-test-renderer/(.*)$': '<rootDir>/../../node_modules/react-test-renderer/$1',
  },
};

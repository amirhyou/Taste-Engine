const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// In this npm workspaces monorepo, root node_modules has react@18 while
// this app requires react@19. Force Metro to resolve react and react-dom
// to the app-local copies so every package in the bundle uses one instance.
const appNodeModules = path.resolve(__dirname, 'node_modules');

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept react and react-dom (including subpaths like react/jsx-runtime)
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-dom' ||
    moduleName.startsWith('react-dom/')
  ) {
    // Resolve from the app's local node_modules, not the monorepo root
    const resolved = require.resolve(moduleName, { paths: [appNodeModules] });
    return { type: 'sourceFile', filePath: resolved };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

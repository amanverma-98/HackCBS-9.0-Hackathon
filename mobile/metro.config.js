const {getDefaultConfig,mergeConfig}=require('@react-native/metro-config');
const path=require('path');

module.exports=mergeConfig(getDefaultConfig(__dirname),{
  watchFolders:[path.resolve(__dirname,'..')],
  resolver:{
    nodeModulesPaths:[path.resolve(__dirname,'../node_modules')],
    // Gradle creates and removes temporary packaging folders while Metro scans.
    // Excluding generated Android output prevents ENOENT watcher races on clean builds.
    blockList:/[\\/]mobile[\\/]android[\\/](?:app[\\/])?build[\\/].*/,
  },
});

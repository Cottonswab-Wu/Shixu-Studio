'use strict';
const path = require('node:path');

// Only an explicitly packaged release can use folder-local data. Development
// keeps its existing profile even when a portable launcher variable is present.
function distributionProfile({ packaged, metadata, appData, executablePath, portableDirectory }) {
  const portable = packaged === true && metadata?.studioDistribution?.portable === true;
  const directory = portable && typeof portableDirectory === 'string' && path.isAbsolute(portableDirectory)
    ? path.resolve(portableDirectory) : path.dirname(path.resolve(executablePath));
  return {
    portable,
    dataRoot: portable ? path.join(directory, 'ShixuStudioData') : path.join(appData, 'ShixuStudio'),
    initialBoard: portable && metadata.studioDistribution.initialBoard === 'empty' ? 'empty' : 'demo',
    applicationId: portable ? 'studio.shixu.board.portable' : 'studio.shixu.board'
  };
}

module.exports = { distributionProfile };

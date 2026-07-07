const path = require('path');
const { createFilesystemStorage } = require('./filesystem');
const { createNetlifyStorage } = require('./netlify');

function createStorage({ root, storageRoot }) {
  const repoDataFile = path.join(root, 'data', 'products.json');

  if (process.env.NETLIFY === 'true') {
    return createNetlifyStorage({ repoDataFile });
  }

  return createFilesystemStorage({
    storageRoot: storageRoot || path.join(root, 'data'),
    repoDataFile,
  });
}

module.exports = { createStorage };

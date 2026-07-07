const path = require('path');
const { createFilesystemStorage } = require('./filesystem');
const { createNetlifyStorage } = require('./netlify');

function isNetlifyRuntime() {
  return (
    process.env.NETLIFY === 'true' ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.LAMBDA_TASK_ROOT)
  );
}

function createStorage({ root, storageRoot }) {
  const repoDataFile = path.join(root, 'data', 'products.json');

  if (isNetlifyRuntime()) {
    return createNetlifyStorage({ repoDataFile });
  }

  return createFilesystemStorage({
    storageRoot: storageRoot || path.join(root, 'data'),
    repoDataFile,
  });
}

module.exports = { createStorage, isNetlifyRuntime };

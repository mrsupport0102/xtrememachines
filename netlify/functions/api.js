const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');
const { createApp } = require('../../server/createApp');

const app = createApp({ serveStatic: false });
const slsHandler = serverless(app);

exports.handler = async (event, context) => {
  if (event?.blobs) {
    connectLambda(event);
  }
  return slsHandler(event, context);
};

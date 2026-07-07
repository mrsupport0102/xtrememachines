const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');
const { createApp } = require('../../server/createApp');

const app = createApp({ serveStatic: false });
const slsHandler = serverless(app);

exports.handler = async (event, context) => {
  try {
    if (event?.blobs) connectLambda(event);
  } catch (err) {
    console.error('connectLambda fejlede:', err.message);
  }
  return slsHandler(event, context);
};

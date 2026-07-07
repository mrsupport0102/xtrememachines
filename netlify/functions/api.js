const serverless = require('serverless-http');
const { createApp } = require('../../server/createApp');

const app = createApp({ serveStatic: false });
const handler = serverless(app);

exports.handler = async (event, context) => handler(event, context);

import { handle } from '../src/app.js';

export const onRequest = (context) => handle(context.request, context.env);

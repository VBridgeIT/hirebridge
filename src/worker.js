// Cloudflare Worker entry point. Files in public/ (CSS, fonts, logo) are served by Cloudflare before
// this runs; every other request comes here.
import { handle } from './app.js';

export default {
  fetch(request, env, ctx) {
    return handle(request, env, { access: ctx && ctx.access });
  },
};

import { html, raw } from '../html.js';

const LOGO = raw('<img class="mark" src="/assets/img/logo-mark.svg" alt="" width="54" height="28">');

export function layout({ title, user, body, nav = 'employees', banner = null }) {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} · H-1B Tracker</title>
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<a class="skip" href="#main">Skip to main content</a>
<header class="top">
  <div class="wrap bar">
    <a class="brand" href="/employees">${LOGO}<span class="brand-name">H-1B Tracker</span><span class="brand-org">VBridgeIT</span></a>
    ${user ? html`<nav class="nav" aria-label="Main">
      <a href="/employees"${nav === 'employees' ? raw(' aria-current="page"') : ''}>Employees</a>
    </nav>
    <div class="who"><span class="who-email">${user}</span> <a href="/cdn-cgi/access/logout">Sign out</a></div>` : ''}
  </div>
</header>
${banner}
<main id="main" class="wrap main" tabindex="-1">
${body}
</main>
<footer class="foot">
  <div class="wrap">This tracker helps HR stay organized. It is not legal advice; the immigration attorney confirms anything that affects a filing. Do not enter passport, Social Security or other ID numbers.</div>
</footer>
</body>
</html>`;
}

export function messagePage({ title, heading, text, user = null, status = 200 }) {
  return { status, body: layout({ title, user, body: html`<div class="panel narrow"><h1>${heading}</h1>${text}</div>` }) };
}

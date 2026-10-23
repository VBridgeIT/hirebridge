import test from 'node:test';
import assert from 'node:assert/strict';
import { html, raw } from '../../src/html.js';

test('values are escaped unless wrapped in raw()', () => {
  const name = '<script>alert("x")</script> & \'co\'';
  assert.equal(String(html`<p>${name}</p>`), '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;co&#39;</p>');
  assert.equal(String(html`<p>${raw('<b>ok</b>')}</p>`), '<p><b>ok</b></p>');
  assert.equal(String(html`<ul>${['a', '<b>'].map((x) => html`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>&lt;b&gt;</li></ul>');
  assert.equal(String(html`${null}${undefined}${false}${0}`), '0');
});

"""End-to-end checks against a running local copy (see tests/e2e/run.sh).

Uses Playwright for Python. The database must start empty.
Optional: set AXE_JS to the path of axe.min.js to run an accessibility scan on each main page.
"""
import os
import re
import sys
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BASE_URL', 'http://localhost:8791')
AXE_JS = os.environ.get('AXE_JS')
SHOTS = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(SHOTS, exist_ok=True)
failures = []


def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond:
        failures.append(msg)


def axe(page, label):
    if not AXE_JS:
        return
    page.add_script_tag(path=AXE_JS)
    v = page.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21aa','best-practice']}).then(r=>r.violations.map(v=>v.id+' ('+v.nodes.length+') '+v.nodes[0].target.join(' ')))")
    check(not v, f'accessibility: {label} has no axe violations {v if v else ""}')


def fill(page, values):
    for name, value in values.items():
        el = page.locator(f'[name="{name}"]')
        if el.evaluate('e => e.tagName') == 'SELECT':
            el.select_option(value)
        else:
            el.fill(value)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, bypass_csp=True)
    page = ctx.new_page()

    # Security headers and empty state
    resp = page.goto(f'{BASE}/employees')
    h = resp.headers
    check(resp.status == 200, 'employee list loads')
    check("script-src" not in h.get('content-security-policy', '') and "default-src 'none'" in h.get('content-security-policy', ''), 'CSP allows no scripts')
    check(h.get('cache-control') == 'no-store', 'pages are not cached')
    check('noindex' in h.get('x-robots-tag', ''), 'pages are not indexed')
    check(h.get('x-frame-options') == 'DENY', 'pages cannot be framed')
    check(page.locator('h2', has_text='No employees yet').count() == 1, 'empty state shows')
    axe(page, 'empty list')

    # Cross-site form posts are refused
    r = ctx.request.post(f'{BASE}/employees', form={'full_name': 'X', 'status': 'active'}, headers={'Origin': 'https://evil.example'})
    check(r.status == 403, 'cross-site POST is blocked')

    # Add employee: validation, then success
    page.goto(f'{BASE}/employees/new')
    axe(page, 'add employee form')
    fill(page, {'status': 'former', 'work_email': 'not-an-email'})
    page.click('button:has-text("Add employee")')
    check(page.locator('.error-summary li').count() == 3, 'three errors listed (name, email, end date)')
    expect(page.locator('#f-full_name')).to_have_attribute('aria-invalid', 'true')
    page.screenshot(path=f'{SHOTS}/form-errors.png', full_page=True)
    axe(page, 'form with errors')
    page.locator('.error-summary a').first.click()
    check(page.evaluate('location.hash') == '#f-full_name', 'error summary links to the field')
    name = 'Ravi <script>alert(1)</script> Test'
    fill(page, {'full_name': name, 'status': 'active', 'work_email': 'Ravi.Test@Example.com', 'job_title': 'Java Developer',
                'hire_date': '2025-01-06', 'work_auth_type': 'H-1B', 'work_auth_expiry': '2027-09-30'})
    page.click('button:has-text("Add employee")')
    check(page.locator('.flash').inner_text() == 'Employee added.', 'employee saved with message')
    check(page.locator('h1').inner_text() == name, 'name with HTML is shown as text, not run')
    emp_url = page.url.split('?')[0]
    emp_id = emp_url.rsplit('/', 1)[1]
    check('ravi.test@example.com' in page.content(), 'email stored in lower case')
    check(page.locator('.note', has_text='No approved or pending H-1B petition').count() == 1, 'missing petition is flagged')

    # Add LCA: errors, then success
    page.click('text=Add LCA')
    fill(page, {'case_number': 'I-200-1', 'begin_date': '2025-01-06', 'end_date': '2028-01-07', 'wage': '80000', 'prevailing_wage': '90000'})
    page.click('button:has-text("Add LCA")')
    errs = page.locator('.error-summary').inner_text()
    check('I-200-25190-123456' in errs and '3 years' in errs and 'below the prevailing wage' in errs, 'LCA checks: case number, 3-year limit, wage')
    axe(page, 'LCA form with errors')
    fill(page, {'case_number': 'i-200-24350-654321', 'end_date': '2027-12-31', 'wage': '$98,500', 'prevailing_wage': '91,000',
                'certified_date': '2024-12-20', 'soc_code': '15-1252', 'worksite_address': '123 Main St', 'worksite_city': 'Charlotte',
                'worksite_state': 'NC', 'worksite_zip': '28202', 'pw_level': 'II', 'pw_source': 'OFLC'})
    page.click('button:has-text("Add LCA")')
    check(page.locator('.flash').inner_text() == 'LCA added.', 'LCA saved')
    card = page.locator('.card').first
    check('I-200-24350-654321' in card.inner_text() and '$98,500 per year' in card.inner_text(), 'LCA card shows upper-cased case number and wage')

    # Add petition linked to the LCA
    page.click('text=Add petition')
    fill(page, {'status': 'approved'})
    page.click('button:has-text("Add petition")')
    check('start date from the approval notice' in page.locator('.error-summary').inner_text(), 'approved petition needs dates')
    fill(page, {'receipt_number': 'eac2590012345', 'validity_start': '2025-01-06', 'validity_end': '2028-01-06'})
    page.click('button:has-text("Add petition")')
    check('after the LCA ends' in page.locator('.error-summary').inner_text(), 'petition dates must fit inside the LCA')
    fill(page, {'validity_end': '2027-12-31'})
    page.click('button:has-text("Add petition")')
    check(page.locator('.flash').inner_text() == 'Petition added.', 'petition saved')
    keydates = page.locator('.keydates').inner_text()
    check('12/31/2027' in keydates and '09/30/2027' in keydates, 'key dates show H-1B end and I-9 (from work authorization)')
    page.screenshot(path=f'{SHOTS}/employee.png', full_page=True)
    axe(page, 'employee page')

    # Edit employee and see it in the history
    page.click('text=Edit employee')
    fill(page, {'job_title': 'Senior Java Developer', 'i9_reverify_date': '2027-09-15'})
    page.click('button:has-text("Save changes")')
    check(page.locator('.flash').inner_text() == 'Employee details saved.', 'edit saved')
    first = page.locator('.history > li').first
    check('Edited employee' in first.inner_text(), 'history shows the edit first')
    first.locator('summary').click()
    check('Java Developer → Senior Java Developer' in first.inner_text(), 'history shows old and new values')
    check('hr@vbridgeit.com' in first.inner_text(), 'history shows who made the change')
    page.click('text=Edit employee')
    page.click('button:has-text("Save changes")')
    check(page.locator('.flash').inner_text() == 'Nothing was changed.', 'saving with no changes is reported')

    # Two people editing at once: the second save is refused
    a = ctx.new_page(); b = ctx.new_page()
    a.goto(f'{emp_url}/edit'); b.goto(f'{emp_url}/edit')
    fill(a, {'notes': 'First edit'}); a.click('button:has-text("Save changes")')
    fill(b, {'notes': 'Second edit'})
    b.click('button:has-text("Save changes")')
    check('Someone else changed this record' in b.content(), 'conflicting edit is refused')
    a.close(); b.close()

    # Delete rules
    page.goto(emp_url)
    lca_delete = page.locator('.card a.danger-link').first
    lca_delete.click()
    check('cannot be deleted yet' in page.content(), 'LCA linked to a petition cannot be deleted')
    page.goto(emp_url)
    page.locator('.row-actions a.danger-link').first.click()
    axe(page, 'delete confirmation')
    page.click('button:has-text("Delete this petition")')
    check(page.locator('.flash').inner_text() == 'Petition deleted.', 'petition deleted')
    page.locator('.card a.danger-link').first.click()
    page.click('button:has-text("Delete this LCA")')
    check(page.locator('.flash').inner_text() == 'LCA deleted.', 'LCA deleted')
    check('Deleted LCA I-200-24350-654321' in page.locator('.history').inner_text(), 'deletion recorded in history')

    # Bad URLs
    r = page.goto(f'{BASE}/employees/99999')
    check(r.status == 404, 'unknown employee gives 404')
    r = page.goto(f'{BASE}/lcas/abc/edit')
    check(r.status == 404, 'bad id gives 404')

    # Sample data, list, search and filters
    page.goto(f'{BASE}/employees')
    check(page.locator('text=Load sample data').count() == 0, 'sample button hidden once real data exists')
    ctx.request.post(f'{BASE}/sample', form={'do': 'load'}, headers={'Origin': BASE})
    page.goto(f'{BASE}/employees')
    rows = page.locator('table.list tbody tr')
    check(rows.count() == 5, 'list shows 5 active employees (4 samples + 1 real)')
    check('Tomás Herrera' in rows.first.inner_text(), 'most urgent employee (lapsed) is listed first')
    check(page.locator('.when-overdue').count() >= 1 and page.locator('.when-soon').count() >= 1, 'overdue and soon dates are highlighted')
    page.screenshot(path=f'{SHOTS}/list.png', full_page=True)
    axe(page, 'employee list')
    page.goto(f'{BASE}/employees?status=former')
    check(page.locator('table.list tbody tr').count() == 1, 'former filter shows the former employee')
    page.goto(f'{BASE}/employees?status=all&q=dallas')
    check(page.locator('table.list tbody tr').count() == 1 and 'Tomás' in page.content(), 'search by city works')
    page.goto(f'{BASE}/employees?q=EAC9999900003')
    check(page.locator('table.list tbody tr').count() == 1 and 'Daniel Okafor' in page.content(), 'search by receipt number works')
    page.goto(f'{BASE}/employees?q=zzzz')
    check('No employees match' in page.content(), 'no-match message')
    ctx.request.post(f'{BASE}/sample', form={'do': 'remove'}, headers={'Origin': BASE})
    page.goto(f'{BASE}/employees?status=all')
    check(page.locator('table.list tbody tr').count() == 1, 'sample employees removed, real one kept')

    # Phone layout
    phone = browser.new_context(viewport={'width': 375, 'height': 812}, bypass_csp=True).new_page()
    phone.goto(emp_url)
    sw = phone.evaluate('document.documentElement.scrollWidth')
    check(sw <= 375, f'no sideways scrolling on a phone (width {sw})')
    phone.screenshot(path=f'{SHOTS}/phone-employee.png', full_page=True)

    browser.close()

print(f'\n{len(failures)} failure(s)')
sys.exit(1 if failures else 0)

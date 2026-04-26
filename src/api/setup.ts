import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../db/client';
import { getAuthorizationUrl } from '../hubspot/auth';

const router = Router();

router.get('/setup', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(setupPageHtml());
});

router.post('/setup/start', async (req: Request, res: Response) => {
  const { name, email } = req.body as { name?: string; email?: string };

  if (!name?.trim()) {
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(setupPageHtml('Company name is required.'));
    return;
  }
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(setupPageHtml('A valid email address is required.'));
    return;
  }

  try {
    const raw = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const apiKey = raw.slice(0, 40);
    const data = { name: name.trim(), email: email.trim(), apiKey };
    try {
      await prisma.tenant.create({ data });
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      if (!msg.includes("Can't reach database server")) throw firstErr;
      // Neon free tier cold start — wait for it to wake up and retry once
      await new Promise(r => setTimeout(r, 2500));
      await prisma.tenant.create({ data });
    }
    res.redirect('/auth/hubspot?apiKey=' + apiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[setup] Tenant creation failed:', err);
    const isConnErr = msg.includes("Can't reach database server");
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(setupPageHtml(
      isConnErr
        ? 'Service is starting up — please try again in a few seconds.'
        : 'Something went wrong. Please try again.'
    ));
  }
});

router.get('/setup/done', (req: Request, res: Response) => {
  const apiKey = req.query.apiKey as string | undefined;
  if (!apiKey) { res.redirect('/setup'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(donePageHtml(apiKey));
});

// ── Shared styles ────────────────────────────────────────────────────────────

const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

const BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  background: #F8FAFC;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  color: #0F172A;
}
.card {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 460px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #0F172A;
  margin-bottom: 32px;
}
.logo-dot {
  width: 8px; height: 8px;
  background: #0369A1;
  border-radius: 50%;
  flex-shrink: 0;
}
.steps {
  display: flex;
  align-items: flex-start;
  margin-bottom: 32px;
}
.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}
.step-line {
  flex: 1;
  height: 1px;
  background: #E2E8F0;
  margin-top: 14px;
}
.step-line.done { background: #0369A1; }
.step-circle {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 1.5px solid #CBD5E1;
  background: #fff;
  color: #94A3B8;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-circle.active { border-color: #0369A1; background: #0369A1; color: #fff; }
.step-circle.complete { border-color: #0369A1; background: #0369A1; color: #fff; }
.step-label {
  font-size: 11px;
  font-weight: 500;
  color: #94A3B8;
  text-align: center;
  white-space: nowrap;
}
.step-label.active  { color: #0369A1; font-weight: 600; }
.step-label.complete { color: #0369A1; }
h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 8px; }
.subtitle { font-size: 14px; color: #64748B; line-height: 1.6; margin-bottom: 28px; }
label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
input[type="text"], input[type="email"] {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid #CBD5E1;
  border-radius: 10px;
  font-family: inherit;
  font-size: 15px;
  color: #0F172A;
  background: #fff;
  outline: none;
  transition: border-color 150ms ease;
  margin-bottom: 16px;
}
input:focus { border-color: #0369A1; box-shadow: 0 0 0 3px rgba(3,105,161,0.08); }
input::placeholder { color: #94A3B8; }
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  background: #0369A1;
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 150ms ease;
  margin-top: 6px;
}
.btn:hover { background: #0284C7; }
.btn:active { background: #075985; transform: scale(0.99); }
.error-banner {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: #991B1B;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
`;

// ── Step indicator ───────────────────────────────────────────────────────────

function stepsHtml(currentStep: number): string {
  const labels = ['Your account', 'Connect HubSpot', "You're ready"];
  const checkSvg = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const parts: string[] = [];
  labels.forEach((label, i) => {
    const n = i + 1;
    const isComplete = n < currentStep;
    const isActive = n === currentStep;
    const cls = isComplete ? 'complete' : isActive ? 'active' : '';
    const inner = isComplete ? checkSvg : String(n);
    parts.push(
      '<div class="step-item">' +
        '<div class="step-circle ' + cls + '">' + inner + '</div>' +
        '<span class="step-label ' + cls + '">' + label + '</span>' +
      '</div>'
    );
    if (i < labels.length - 1) {
      const lineDone = (n + 1) <= currentStep;
      parts.push('<div class="step-line ' + (lineDone ? 'done' : '') + '"></div>');
    }
  });

  return '<div class="steps">' + parts.join('') + '</div>';
}

// ── Page: /setup ─────────────────────────────────────────────────────────────

function setupPageHtml(error?: string): string {
  const errorHtml = error
    ? '<div class="error-banner">' +
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6.5" stroke="#DC2626" stroke-width="1.4"/><path d="M8 5v3.5M8 10.5v.5" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round"/></svg>' +
        error +
      '</div>'
    : '';

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>Get started \u2014 Rapport</title>\n' +
    FONT_LINK + '\n' +
    '<style>' + BASE_CSS + '</style>\n' +
    '</head>\n<body>\n' +
    '<div class="card">\n' +
      '<div class="logo"><span class="logo-dot"></span>Rapport</div>\n' +
      stepsHtml(1) +
      '<h1>Get started</h1>\n' +
      '<p class="subtitle">Personalised holiday greetings for your HubSpot contacts \u2014 delivered every Monday morning.</p>\n' +
      errorHtml +
      '<form method="POST" action="/setup/start">\n' +
        '<label for="name">Company name</label>\n' +
        '<input type="text" id="name" name="name" placeholder="Acme Corp" required autocomplete="organization">\n' +
        '<label for="email">Your email</label>\n' +
        '<input type="email" id="email" name="email" placeholder="you@company.com" required autocomplete="email">\n' +
        '<button type="submit" class="btn">\n' +
          'Continue\n' +
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n' +
        '</button>\n' +
      '</form>\n' +
    '</div>\n' +
    '</body>\n</html>';
}

// ── Page: /setup/done ─────────────────────────────────────────────────────────

function donePageHtml(apiKey: string): string {
  const DONE_CSS = `
.success-ring {
  width: 52px; height: 52px;
  background: #DCFCE7;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}
.sync-box {
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 20px;
}
.sync-title { font-size: 13px; font-weight: 600; color: #0F172A; margin-bottom: 6px; }
.sync-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; }
.spinner {
  width: 14px; height: 14px;
  border: 2px solid #E2E8F0;
  border-top-color: #0369A1;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.sync-check { color: #16A34A; display: none; flex-shrink: 0; }
.whats-next {
  background: #EFF6FF;
  border-radius: 12px;
  padding: 18px 20px;
}
.whats-next-title { font-size: 13px; font-weight: 700; color: #1D4ED8; margin-bottom: 12px; }
.next-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: #1E40AF;
  line-height: 1.55;
  margin-bottom: 9px;
}
.next-item:last-child { margin-bottom: 0; }
.next-icon { flex-shrink: 0; margin-top: 1px; color: #2563EB; }
`;

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>Connected \u2014 Rapport</title>\n' +
    FONT_LINK + '\n' +
    '<style>' + BASE_CSS + DONE_CSS + '</style>\n' +
    '</head>\n<body>\n' +
    '<div class="card">\n' +
      '<div class="logo"><span class="logo-dot"></span>Rapport</div>\n' +
      stepsHtml(4) +
      '<div class="success-ring">' +
        '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4.5 11.5L9 16L17.5 6" stroke="#16A34A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</div>\n' +
      '<h1>HubSpot connected!</h1>\n' +
      '<p class="subtitle" style="margin-bottom:22px">You\'re all set. We\'ve sent your account details to the email address you registered with.</p>\n' +

      '<div class="sync-box">\n' +
        '<div class="sync-title">Initial contact sync</div>\n' +
        '<div class="sync-row">\n' +
          '<div class="spinner" id="sync-spinner"></div>\n' +
          '<svg class="sync-check" id="sync-check" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>\n' +
          '<span id="sync-text">Syncing your HubSpot contacts\u2026</span>\n' +
        '</div>\n' +
      '</div>\n' +

      '<div class="whats-next">\n' +
        '<div class="whats-next-title">What happens next</div>\n' +
        '<div class="next-item">\n' +
          '<svg class="next-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 7h12M5 1v4M11 1v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>\n' +
          '<span>Every Monday at 7am local time you\'ll receive a holiday digest for your active contacts.</span>\n' +
        '</div>\n' +
        '<div class="next-item">\n' +
          '<svg class="next-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 5.5l6 4 6-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>\n' +
          '<span>Each card includes an AI-written greeting draft you can send in one click.</span>\n' +
        '</div>\n' +
        '<div class="next-item">\n' +
          '<svg class="next-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8A5.5 5.5 0 1 1 9.5 3M13.5 2.5v5H8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>\n' +
          '<span>Contacts sync daily. Holidays are matched and greetings generated automatically.</span>\n' +
        '</div>\n' +
      '</div>\n' +
    '</div>\n' +

    '<script>\n' +
    'var API_KEY = "' + apiKey + '";\n' +
    '\n' +
    'async function triggerSync() {\n' +
    '  try {\n' +
    '    var headers = { "Authorization": "Bearer " + API_KEY, "Content-Type": "application/json" };\n' +
    '    await fetch("/api/sync/owners", { method: "POST", headers: headers });\n' +
    '    var res = await fetch("/api/sync/contacts", { method: "POST", headers: headers, body: JSON.stringify({ activeOnly: true }) });\n' +
    '    var data = await res.json();\n' +
    '    document.getElementById("sync-spinner").style.display = "none";\n' +
    '    document.getElementById("sync-check").style.display = "flex";\n' +
    '    document.getElementById("sync-text").textContent = typeof data.synced === "number" ? data.synced + " contacts synced" : "Sync complete";\n' +
    '  } catch (e) {\n' +
    '    document.getElementById("sync-spinner").style.display = "none";\n' +
    '    document.getElementById("sync-text").textContent = "Sync will run automatically tonight.";\n' +
    '  }\n' +
    '}\n' +
    '\n' +
    'triggerSync();\n' +
    '</script>\n' +
    '</body>\n</html>';
}

export default router;

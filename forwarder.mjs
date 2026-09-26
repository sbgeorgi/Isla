import http from 'node:http';
import { Resend } from 'resend';

const {
  RESEND_API_KEY,
  RESEND_WEBHOOK_SECRET,
  FORWARD_TO,
  PORT = '10000',
} = process.env;

if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is required');
if (!FORWARD_TO) throw new Error('FORWARD_TO is required');

const resend = new Resend(RESEND_API_KEY);
const CONTACT_FROM = 'Roatán Design <hello@roatan.design>';
const ALLOWED_ORIGINS = new Set([
  'https://roatan.design',
  'https://www.roatan.design',
  'https://roatan-design.onrender.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]);
const rateLimits = new Map();

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const clean = (value, max = 4000) =>
  String(value ?? '').trim().replace(/\u0000/g, '').slice(0, max);

const addressOnly = (value = '') => {
  const match = String(value).match(/<([^<>]+)>/);
  return (match?.[1] || value).trim();
};

const attachmentArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.attachments)) return data.attachments;
  return [];
};

const getOrigin = (req) => String(req.headers.origin || '');
const corsHeaders = (origin) =>
  ALLOWED_ORIGINS.has(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'Origin',
      }
    : {};

const respond = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
};

const respondJson = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body));
};

async function readBody(req, maxBytes = 32_768) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) {
      const error = new Error('payload too large');
      error.status = 413;
      throw error;
    }
  }
  return body;
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0]
    .trim();
}

function rateLimited(req) {
  const now = Date.now();
  const key = clientIp(req);
  const windowMs = 10 * 60 * 1000;
  const limit = 5;

  const entry = rateLimits.get(key);
  if (!entry || now - entry.startedAt > windowMs) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return false;
  }

  entry.count += 1;
  if (rateLimits.size > 2000) {
    for (const [ip, value] of rateLimits) {
      if (now - value.startedAt > windowMs) rateLimits.delete(ip);
    }
  }
  return entry.count > limit;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function normalizeContact(payload) {
  const extras = Array.isArray(payload.extras)
    ? payload.extras.map((item) => clean(item, 120)).filter(Boolean).slice(0, 20)
    : [];

  return {
    name: clean(payload.name, 160),
    email: clean(payload.email, 254).toLowerCase(),
    property: clean(payload.property || payload.business, 240),
    projectType: clean(payload.projectType, 160),
    budget: clean(payload.budget, 120),
    timeline: clean(payload.timeline, 120),
    extras,
    message: clean(payload.message || payload.notes, 5000),
    brief: clean(payload.brief, 8000),
    website: clean(payload.website, 300), // honeypot: must remain blank
  };
}

function contactText(data) {
  const lines = [
    'New project enquiry — Roatán Design',
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.property ? `Property / business: ${data.property}` : null,
    data.projectType ? `Project type: ${data.projectType}` : null,
    data.budget ? `Budget: ${data.budget}` : null,
    data.timeline ? `Timeline: ${data.timeline}` : null,
    data.extras.length ? `Extras: ${data.extras.join(', ')}` : null,
    data.message ? `\nMessage:\n${data.message}` : null,
    data.brief ? `\nProject brief:\n${data.brief}` : null,
  ];
  return lines.filter((line) => line !== null).join('\n');
}

function contactHtml(data) {
  const row = (label, value) =>
    value
      ? `<tr><td style="padding:7px 18px 7px 0;color:#667085;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;color:#253d34">${escapeHtml(value)}</td></tr>`
      : '';

  return `<!doctype html>
<html>
<body style="margin:0;background:#f5f3ed;color:#253d34;font-family:Arial,sans-serif">
  <div style="max-width:680px;margin:0 auto;padding:38px 24px">
    <div style="font-family:Georgia,serif;font-size:34px;line-height:1.1;margin-bottom:8px">New project enquiry</div>
    <div style="font-size:12px;color:#667085;margin-bottom:26px">Submitted through roatan.design</div>
    <table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.55">
      ${row('Name', data.name)}
      ${row('Email', data.email)}
      ${row('Property / business', data.property)}
      ${row('Project type', data.projectType)}
      ${row('Budget', data.budget)}
      ${row('Timeline', data.timeline)}
      ${row('Extras', data.extras.join(', '))}
    </table>
    ${data.message ? `<div style="margin-top:26px;padding-top:22px;border-top:1px solid #d4d8cd"><div style="font-size:12px;color:#667085;margin-bottom:8px">Message</div><div style="white-space:pre-wrap;line-height:1.7">${escapeHtml(data.message)}</div></div>` : ''}
    ${data.brief ? `<div style="margin-top:26px;padding-top:22px;border-top:1px solid #d4d8cd"><div style="font-size:12px;color:#667085;margin-bottom:8px">Project brief</div><div style="white-space:pre-wrap;line-height:1.7">${escapeHtml(data.brief)}</div></div>` : ''}
  </div>
</body>
</html>`;
}

async function handleContact(req, res) {
  const origin = getOrigin(req);
  const cors = corsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return respondJson(res, 403, { ok: false, error: 'origin_not_allowed' });
  }

  if (rateLimited(req)) {
    return respondJson(
      res,
      429,
      { ok: false, error: 'too_many_requests' },
      { ...cors, 'retry-after': '600' },
    );
  }

  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || '{}');
    const data = normalizeContact(payload);

    if (data.website) {
      // Silent success for basic bot submissions.
      return respondJson(res, 200, { ok: true }, cors);
    }

    if (!data.name || !validEmail(data.email)) {
      return respondJson(
        res,
        400,
        { ok: false, error: 'invalid_contact_details' },
        cors,
      );
    }

    if (!data.message && !data.brief && !data.projectType && !data.property) {
      return respondJson(
        res,
        400,
        { ok: false, error: 'empty_enquiry' },
        cors,
      );
    }

    const subjectDetail = data.property || data.name;
    const subject = `New project enquiry — ${subjectDetail}`.slice(0, 180);

    const { data: sent, error } = await resend.emails.send(
      {
        from: CONTACT_FROM,
        to: [FORWARD_TO],
        replyTo: [data.email],
        subject,
        text: contactText(data),
        html: contactHtml(data),
        headers: {
          'X-Roatan-Source': 'website-contact-form',
        },
      },
      {
        idempotencyKey: `roatan-contact/${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    );

    if (error || !sent) {
      throw new Error(error?.message || 'Resend did not return a message id');
    }

    console.log(JSON.stringify({
      event: 'contact_sent',
      outboundId: sent.id,
      replyTo: data.email,
      property: data.property || null,
    }));

    return respondJson(res, 200, { ok: true }, cors);
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('Contact form error:', error);
    return respondJson(
      res,
      status,
      {
        ok: false,
        error: status === 413 ? 'payload_too_large' : 'send_failed',
      },
      cors,
    );
  }
}

async function buildAttachments(emailId, expectedCount) {
  if (!expectedCount) return [];

  const { data, error } =
    await resend.emails.receiving.attachments.list({ emailId });

  if (error) {
    console.error('Attachment listing failed; forwarding body without attachments:', error);
    return [];
  }

  const items = attachmentArray(data);
  return Promise.all(items.map(async (item) => {
    if (!item?.download_url || !item?.filename) return null;

    const response = await fetch(item.download_url);
    if (!response.ok) {
      throw new Error(`Failed to download attachment ${item.filename}: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      filename: item.filename,
      content: buffer.toString('base64'),
      contentType: item.content_type || undefined,
      contentId: item.content_id || undefined,
    };
  })).then((items) => items.filter(Boolean));
}

async function forwardInbound(event) {
  const emailId = event?.data?.email_id;
  if (!emailId) throw new Error('email.received event missing email_id');

  const { data: email, error: emailError } =
    await resend.emails.receiving.get(emailId);

  if (emailError || !email) {
    throw new Error(`Unable to retrieve inbound email: ${emailError?.message || 'unknown error'}`);
  }

  const attachments = await buildAttachments(
    emailId,
    event.data.attachments?.length || 0,
  );

  const originalFrom = event.data.from || email.from || '';
  const originalTo = (event.data.to || email.to || []).join(', ');
  const originalCc = (event.data.cc || email.cc || []).join(', ');
  const subject = event.data.subject || email.subject || '(no subject)';
  const replyTo = addressOnly(originalFrom);

  const metadataText = [
    'Forwarded by Roatán Design',
    `From: ${originalFrom}`,
    `To: ${originalTo}`,
    originalCc ? `Cc: ${originalCc}` : null,
    '',
  ].filter((line) => line !== null).join('\n');

  const text = `${metadataText}\n${email.text || ''}`;
  const htmlHeader = `
    <div style="font:12px/1.55 Arial,sans-serif;color:#667085;border-bottom:1px solid #e5e7eb;padding:0 0 12px;margin:0 0 18px">
      <strong style="color:#344054">Forwarded by Roatán Design</strong><br>
      From: ${escapeHtml(originalFrom)}<br>
      To: ${escapeHtml(originalTo)}
      ${originalCc ? `<br>Cc: ${escapeHtml(originalCc)}` : ''}
    </div>`;

  const html = email.html
    ? `${htmlHeader}${email.html}`
    : `${htmlHeader}<pre style="white-space:pre-wrap;font:14px/1.6 Arial,sans-serif">${escapeHtml(email.text || '')}</pre>`;

  const { data: sent, error: sendError } = await resend.emails.send(
    {
      from: 'Roatán Design <forwarder@roatan.design>',
      to: [FORWARD_TO],
      subject,
      text,
      html,
      replyTo: replyTo ? [replyTo] : undefined,
      attachments: attachments.length ? attachments : undefined,
      headers: {
        'X-Roatan-Inbound-Id': emailId,
        'X-Roatan-Original-To': originalTo.slice(0, 900),
      },
    },
    { idempotencyKey: `roatan-inbound-forward/${emailId}` },
  );

  if (sendError || !sent) {
    throw new Error(`Forwarding failed: ${sendError?.message || 'unknown error'}`);
  }

  console.log(JSON.stringify({
    event: 'forwarded',
    inboundId: emailId,
    outboundId: sent.id,
    originalFrom,
    originalTo,
    attachmentCount: attachments.length,
  }));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    return respond(res, 200, 'roatan.design mail service: ready');
  }

  if (req.url === '/contact' && req.method === 'OPTIONS') {
    const origin = getOrigin(req);
    if (!ALLOWED_ORIGINS.has(origin)) return respond(res, 403, 'forbidden');
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  if (req.url === '/contact' && req.method === 'POST') {
    return handleContact(req, res);
  }

  if (req.method !== 'POST' || req.url !== '/webhooks/resend') {
    return respond(res, 404, 'not found');
  }

  if (!RESEND_WEBHOOK_SECRET) {
    console.error('RESEND_WEBHOOK_SECRET is not configured');
    return respond(res, 503, 'not configured');
  }

  try {
    const payload = await readBody(req, 2_000_000);
    const event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers['svix-id'],
        timestamp: req.headers['svix-timestamp'],
        signature: req.headers['svix-signature'],
      },
      webhookSecret: RESEND_WEBHOOK_SECRET,
    });

    if (event.type === 'email.received') {
      await forwardInbound(event);
    }

    return respond(res, 200, 'ok');
  } catch (error) {
    console.error('Webhook processing error:', error);
    return respond(res, 400, 'invalid webhook');
  }
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`roatan.design mail service listening on :${PORT}`);
});

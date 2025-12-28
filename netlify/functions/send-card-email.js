export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { to, cardName, vibe, bodyText, cardImageUrl, shareUrl } = await req.json();

    if (!to || !cardName || !cardImageUrl) {
      return new Response("Missing fields", { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL;

    if (!RESEND_API_KEY || !FROM_EMAIL) {
      return new Response("Server not configured: missing env vars", { status: 500 });
    }

    const imgRes = await fetch(cardImageUrl);
    if (!imgRes.ok) {
      return new Response(`Image fetch failed: ${imgRes.status}`, { status: 400 });
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const base64 = buffer.toString("base64");

    const html = `
      <div style="font-family:Inter,Arial;background:#020617;color:#f1f5f9;padding:24px">
        <div style="max-width:520px;margin:0 auto;background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden">
          <div style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);letter-spacing:.25em;font-weight:900;font-size:11px;color:#cbd5e1">
            DREAM ORACLE
          </div>
          <div style="padding:18px">
            <div style="color:#9b0aa5;font-size:11px;letter-spacing:.25em;font-weight:900;text-transform:uppercase">Electric Dream</div>
            <div style="font-size:34px;font-weight:900;margin-top:8px">${esc(cardName)}</div>
            <div style="margin-top:8px;font-size:12px;color:#94a3b8">Frequenza: <b style="color:#e2e8f0">${esc(vibe || "")}</b></div>
            <div style="margin:14px 0;height:1px;background:rgba(255,255,255,.12)"></div>
            <img src="${esc(cardImageUrl)}" alt="${esc(cardName)}" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.15)">
            <p style="margin-top:14px;font-size:16px;line-height:1.55;color:#f8fafc;font-style:italic">“${esc(bodyText || "")}”</p>
            ${shareUrl ? `<p style="margin-top:14px"><a href="${esc(shareUrl)}" style="color:#e2e8f0;text-decoration:underline">Apri la tua card</a></p>` : ""}
          </div>
        </div>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `Dream Oracle — ${cardName} ⚡`,
        html,
        attachments: [{ filename: `${cardName}.jpg`, content: base64 }],
      }),
    });

    if (!resendRes.ok) {
      const t = await resendRes.text().catch(() => "");
      return new Response(`Resend error: ${t}`, { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`Server error: ${e?.message || e}`, { status: 500 });
  }
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[c]));
}

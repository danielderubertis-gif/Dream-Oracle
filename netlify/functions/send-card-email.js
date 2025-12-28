export default async (req) => {
  try {
    // Only POST
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { to, cardName, vibe, bodyText, cardImageUrl, shareUrl } = await req.json();

    if (!to || !cardName || !cardImageUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing fields: to, cardName, cardImageUrl" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing RESEND_API_KEY env var" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ✅ HARDCODED FROM for test (bypasses FROM_EMAIL env issues)
    const FROM_EMAIL = "Dream Oracle <onboarding@resend.dev>";

    // Fetch image (public URL) and attach
    const imgRes = await fetch(cardImageUrl);
    if (!imgRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `Image fetch failed: ${imgRes.status}`, url: cardImageUrl }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
            ${
              shareUrl
                ? `<p style="margin-top:14px"><a href="${esc(shareUrl)}" style="color:#e2e8f0;text-decoration:underline">Apri la tua card</a></p>`
                : ""
            }
          </div>
        </div>
      </div>
    `;

    const payload = {
      from: FROM_EMAIL,
      to: [to],
      subject: `Dream Oracle — ${cardName} ⚡`,
      html,
      attachments: [{ filename: `${cardName}.jpg`, content: base64 }],
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resendRes.ok) {
      const t = await resendRes.text().catch(() => "");
      // Log useful debug in Netlify logs
      console.error("Resend error:", resendRes.status, t);
      return new Response(
        JSON.stringify({ ok: false, error: "Resend error", status: resendRes.status, detail: t }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await resendRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: true, resend: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Server error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: `Server error: ${e?.message || e}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

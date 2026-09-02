import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactRequestBody {
  name: string;
  email: string;
  msg: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ContactRequestBody>;
  const { name, email, msg } = body;

  if (!name?.trim() || !email?.trim() || !msg?.trim()) {
    return Response.json(
      { ok: false, message: "Todos los campos son obligatorios." },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return Response.json(
      { ok: false, message: "El correo electrónico no tiene un formato válido." },
      { status: 400 }
    );
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to: process.env.CONTACT_TO_EMAIL!,
      replyTo: email.trim(),
      subject: `Nuevo mensaje de contacto — ${name.trim()}`,
      text: `Nombre: ${name.trim()}\nCorreo: ${email.trim()}\n\nMensaje:\n${msg.trim()}`,
    });

    if (error) {
      return Response.json({ ok: false, message: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, message: "No se pudo enviar el mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

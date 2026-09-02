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

  return Response.json({ ok: true });
}

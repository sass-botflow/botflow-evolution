/**
 * Maps production backend `/api/whatsapp/sessions` responses to the
 * Evolution channel shape expected by the dashboard UI.
 */
export interface LegacyWhatsAppSession {
  id: string;
  status?: string;
  phoneNumber?: string | null;
  displayName?: string | null;
}

export interface LegacyWhatsAppQrPayload {
  base64?: string;
  status?: string;
  expiresIn?: number;
}

export interface LegacyWhatsAppStatusPayload {
  status?: string;
  phoneNumber?: string | null;
  displayName?: string | null;
}

function unwrapSession(body: unknown): LegacyWhatsAppSession {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid WhatsApp session response.");
  }

  const record = body as { session?: LegacyWhatsAppSession } & LegacyWhatsAppSession;
  return record.session ?? record;
}

export function mapSessionToConnectResponse(body: unknown) {
  const session = unwrapSession(body);

  if (!session.id) {
    throw new Error("WhatsApp session response is missing an id.");
  }

  return {
    instanceId: session.id,
    status: "waiting_qr" as const,
  };
}

export function mapSessionQrResponse(body: unknown) {
  const payload = body as LegacyWhatsAppQrPayload;

  return {
    qrCode: payload.base64,
    base64: payload.base64,
    expiresIn: payload.expiresIn,
    status: payload.status,
  };
}

export function mapSessionStatusResponse(body: unknown) {
  const payload = body as LegacyWhatsAppStatusPayload;

  return {
    status: payload.status,
    phoneNumber:
      typeof payload.phoneNumber === "string" ? payload.phoneNumber : null,
    profileName: payload.displayName ?? null,
  };
}

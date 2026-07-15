import { parseJsonResponse } from "@/lib/api/parse-json-response";
import type {
  WhatsAppConnectResponse,
  WhatsAppDisconnectResponse,
  WhatsAppQrResponse,
  WhatsAppSendPayload,
  WhatsAppSendResponse,
  WhatsAppStatusResponse,
} from "@/lib/whatsapp/evolution-types";

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await parseJsonResponse<T & { error?: string; message?: string }>(
    response,
  );

  if (!response.ok) {
    const message = body.error ?? body.message ?? `Request failed (${response.status})`;

    if (response.status === 404 && path.includes("/whatsapp/connect")) {
      throw new Error(
        "WhatsApp connect is not available. Check Evolution API configuration on the server.",
      );
    }

    if (response.status >= 502) {
      throw new Error(
        message.includes("Evolution")
          ? message
          : "WhatsApp service is temporarily unavailable. Please try again.",
      );
    }

    throw new Error(message);
  }

  return body;
}

export function fetchWhatsAppConnectPreview(): Promise<WhatsAppConnectResponse> {
  return requestJson<WhatsAppConnectResponse>("/api/channels/whatsapp/connect");
}

export function connectWhatsAppInstance(): Promise<WhatsAppConnectResponse> {
  return requestJson<WhatsAppConnectResponse>("/api/channels/whatsapp/connect", {
    method: "POST",
  });
}

export function fetchWhatsAppQr(instanceId: string): Promise<WhatsAppQrResponse> {
  return requestJson<{
    qrCode?: string;
    base64?: string;
    expiresIn?: number;
    expiresAt?: string;
    status?: string;
  }>(`/api/channels/whatsapp/${encodeURIComponent(instanceId)}/qr`).then((body) => ({
    qrCode: body.qrCode ?? body.base64,
    base64: body.base64 ?? body.qrCode,
    expiresIn: body.expiresIn,
    expiresAt: body.expiresAt,
    status: body.status as WhatsAppQrResponse["status"],
  }));
}

export function fetchWhatsAppStatus(
  instanceId: string,
): Promise<WhatsAppStatusResponse> {
  return requestJson<{
    status: string;
    phone?: string | null;
    phoneNumber?: string | null;
    profileName?: string | null;
    profilePictureUrl?: string | null;
    connectedAt?: string | null;
    lastSeen?: string | null;
    messagesToday?: number;
  }>(`/api/channels/whatsapp/${encodeURIComponent(instanceId)}/status`).then(
    (body) => ({
      status: body.status as WhatsAppStatusResponse["status"],
      phoneNumber: body.phoneNumber ?? body.phone ?? null,
      profileName: body.profileName ?? null,
      profilePictureUrl: body.profilePictureUrl ?? null,
      connectedAt: body.connectedAt ?? null,
      lastSeen: body.lastSeen ?? null,
      messagesToday: body.messagesToday ?? 0,
    }),
  );
}

export function disconnectWhatsAppInstance(
  instanceId: string,
): Promise<WhatsAppDisconnectResponse> {
  return requestJson<WhatsAppDisconnectResponse>(
    `/api/channels/whatsapp/${encodeURIComponent(instanceId)}`,
    { method: "DELETE" },
  );
}

export function sendWhatsAppMessage(
  instanceId: string,
  payload: WhatsAppSendPayload,
): Promise<WhatsAppSendResponse> {
  return requestJson<WhatsAppSendResponse>("/api/channels/whatsapp/send", {
    method: "POST",
    body: JSON.stringify({ instanceId, ...payload }),
  });
}

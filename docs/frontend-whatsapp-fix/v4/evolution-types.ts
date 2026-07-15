export type WhatsAppInstanceStatus =
  | "WAITING_QR"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED";

export interface WhatsAppConnectResponse {
  instanceId: string;
  status: "waiting_qr" | WhatsAppInstanceStatus;
}

export interface WhatsAppQrResponse {
  qrCode?: string;
  base64?: string;
  expiresIn?: number;
  expiresAt?: string;
  status?: WhatsAppInstanceStatus | "waiting_qr";
}

export interface WhatsAppStatusResponse {
  status: WhatsAppInstanceStatus;
  phoneNumber?: string | null;
  profileName?: string | null;
  profilePictureUrl?: string | null;
  connectedAt?: string | null;
  lastSeen?: string | null;
  messagesToday?: number;
}

export interface WhatsAppSendPayload {
  to: string;
  message: string;
}

export interface WhatsAppSendResponse {
  success: boolean;
  messageId?: string;
}

export interface WhatsAppDisconnectResponse {
  success: boolean;
}

export type WhatsAppConnectErrorCode =
  | "EVOLUTION_OFFLINE"
  | "EVOLUTION_AUTH"
  | "QR_EXPIRED"
  | "CONNECTION_LOST"
  | "ALREADY_CONNECTED"
  | "NO_INTERNET"
  | "UNKNOWN";

export interface WhatsAppChannel {
  instanceId: string;
  status: WhatsAppInstanceStatus;
  phoneNumber?: string | null;
  profileName?: string | null;
  profilePictureUrl?: string | null;
  connectedAt?: string | null;
  lastSeen?: string | null;
  messagesToday?: number;
}

export function normalizeWhatsAppStatus(
  status: string | undefined | null,
): WhatsAppInstanceStatus {
  const normalized = (status ?? "").toUpperCase().replace(/-/g, "_");

  if (normalized === "WAITING_QR" || normalized === "WAITING") {
    return "WAITING_QR";
  }
  if (normalized === "CONNECTING") return "CONNECTING";
  if (normalized === "CONNECTED" || normalized === "OPEN") return "CONNECTED";
  if (normalized === "DISCONNECTED" || normalized === "CLOSE") {
    return "DISCONNECTED";
  }

  return "WAITING_QR";
}

export function resolveQrImageSrc(data: WhatsAppQrResponse | undefined): string | null {
  if (!data) return null;

  const raw = data.qrCode ?? data.base64;
  if (!raw) return null;

  if (raw.startsWith("data:")) return raw;
  return `data:image/png;base64,${raw}`;
}

export function mapApiErrorToWhatsAppCode(message: string): WhatsAppConnectErrorCode {
  const lower = message.toLowerCase();

  if (
    lower.includes("evolution api key") ||
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("invalid key")
  ) {
    return "EVOLUTION_AUTH";
  }

  if (
    lower.includes("could not reach evolution") ||
    lower.includes("evolution api returned html") ||
    lower.includes("offline") ||
    lower.includes("unreachable") ||
    lower.includes("not configured") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("timed out") ||
    lower.includes("timeout")
  ) {
    return "EVOLUTION_OFFLINE";
  }
  if (lower.includes("qr") && lower.includes("expir")) return "QR_EXPIRED";
  if (lower.includes("connection lost") || lower.includes("disconnected")) {
    return "CONNECTION_LOST";
  }
  if (lower.includes("already connected")) return "ALREADY_CONNECTED";
  if (
    lower.includes("network") ||
    lower.includes("internet") ||
    lower.includes("failed to fetch")
  ) {
    return "NO_INTERNET";
  }

  return "UNKNOWN";
}

export const WHATSAPP_QR_POLL_MS = 2_000;
export const WHATSAPP_QR_POLL_MS_WAITING = 1_500;
export const WHATSAPP_STATUS_POLL_MS = 2_500;

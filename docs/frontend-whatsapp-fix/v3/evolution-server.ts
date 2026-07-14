import QRCode from "qrcode";

const INTEGRATION = "WHATSAPP-BAILEYS";
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;
const FAST_FAIL_TIMEOUT_MS = 4_000;

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
}

function isInternalEvolutionUrl(url: string): boolean {
  return /^https?:\/\/(sass-botflow_|botflow-|evolution-api|localhost|127\.0\.0\.1)/i.test(
    url,
  );
}

function getEvolutionBaseUrlCandidates(): string[] {
  const envUrl =
    process.env.EVOLUTION_API_URL?.trim() ||
    process.env.EVOLUTION_API_BASE_URL?.trim();

  const candidates = [
    envUrl,
    "http://evolution-api:8080",
    "http://sass-botflow-evolution-api:8080",
    "http://sass-botflow_evolution-api:8080",
    "http://sass-botflow_botflow-evolution:8080",
    "https://evolution.api.botflow.ink",
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates.map((value) => value.replace(/\/$/, "")))];
}

function getRequestTimeoutMs(baseUrl: string): number {
  return isInternalEvolutionUrl(baseUrl)
    ? FAST_FAIL_TIMEOUT_MS
    : DEFAULT_REQUEST_TIMEOUT_MS;
}

export function getEvolutionConfig(): EvolutionConfig | null {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrls = getEvolutionBaseUrlCandidates();

  if (!apiKey || baseUrls.length === 0) {
    return null;
  }

  return {
    baseUrl: baseUrls[0]!,
    apiKey,
  };
}

export function getEvolutionBaseUrls(): string[] {
  return getEvolutionBaseUrlCandidates();
}

export function isEvolutionConfigured(): boolean {
  return getEvolutionConfig() !== null;
}

export function deriveInstanceName(userId: string): string {
  const userShort = userId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `botflow-${userShort}`;
}

export function extractQrBase64(payload: unknown): string | null {
  if (!payload) return null;

  if (typeof payload === "string" && payload.trim()) {
    return normalizeQrValue(payload.trim());
  }

  if (typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  const directCandidates = [
    record.base64,
    record.qrcode,
    record.qrCode,
    record.qr,
    record.code,
    record.pairingCode,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeQrValue(candidate.trim());
    }
  }

  const nestedKeys = ["qrcode", "qr", "data", "response"];
  for (const key of nestedKeys) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const extracted = extractQrBase64(nested);
      if (extracted) return extracted;
    }
  }

  return null;
}

function normalizeQrValue(value: string): string | null {
  if (!value) return null;

  if (value.startsWith("data:image")) {
    return value;
  }

  // Evolution often returns a raw pairing payload (e.g. "2@...") instead of PNG base64.
  if (value.startsWith("2@")) {
    return value;
  }

  if (value.length < 40) {
    return null;
  }

  return value;
}

export async function resolveQrImageData(raw: string): Promise<string | null> {
  const normalized = normalizeQrValue(raw);
  if (!normalized) return null;

  if (normalized.startsWith("data:image")) {
    return normalized;
  }

  if (normalized.startsWith("2@")) {
    try {
      return await QRCode.toDataURL(normalized, {
        margin: 1,
        width: 512,
        errorCorrectionLevel: "M",
      });
    } catch {
      return null;
    }
  }

  return `data:image/png;base64,${normalized}`;
}

export async function extractQrImageData(payload: unknown): Promise<string | null> {
  const raw = extractQrBase64(payload);
  if (!raw) return null;
  return resolveQrImageData(raw);
}

export function mapConnectionState(
  state?: string,
): "CONNECTED" | "DISCONNECTED" | "WAITING_QR" | "CONNECTING" {
  const normalized = (state ?? "").toLowerCase();

  if (normalized === "open") return "CONNECTED";
  if (normalized === "connecting") return "CONNECTING";
  if (normalized === "close" || normalized === "closed" || normalized === "refused") {
    return "DISCONNECTED";
  }

  return "WAITING_QR";
}

export function extractPhone(owner?: string | null): string | null {
  if (!owner?.trim()) return null;
  return owner.replace(/@.*/, "").replace(/\D/g, "") || null;
}

function isHtmlPayload(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith("<!") || trimmed.includes("<html");
}

function isRetryableNetworkError(message: string): boolean {
  return /fetch failed|econnrefused|enotfound|timeout|abort|cloudflare|bad gateway|gateway/i.test(
    message,
  );
}

async function evolutionRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrls = getEvolutionBaseUrlCandidates();

  if (!apiKey || baseUrls.length === 0) {
    throw new Error("Evolution API is not configured on the frontend server.");
  }

  let lastError: unknown;

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(
          timeoutMs === DEFAULT_REQUEST_TIMEOUT_MS
            ? getRequestTimeoutMs(baseUrl)
            : timeoutMs,
        ),
        cache: "no-store",
      });

      const text = await response.text();

      if (isHtmlPayload(text)) {
        throw new Error(`Evolution API returned HTML from ${baseUrl}`);
      }

      let data: unknown = null;

      if (text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = text;
        }
      }

      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message: unknown }).message === "string"
            ? (data as { message: string }).message
            : data &&
                typeof data === "object" &&
                "error" in data &&
                typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Evolution API request failed (${response.status})`;

        if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Evolution API key is invalid. Set EVOLUTION_API_KEY to match AUTHENTICATION_API_KEY on evolution-api.",
          );
        }

        throw new Error(message);
      }

      return data as T;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (isRetryableNetworkError(message)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? lastError.message
      : "Could not reach Evolution API. Check EVOLUTION_API_URL and EVOLUTION_API_KEY.",
  );
}

export async function testEvolutionConnectivity(): Promise<{
  ok: boolean;
  baseUrl: string | null;
  message: string;
  apiKeyValid?: boolean;
}> {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrls = getEvolutionBaseUrlCandidates();

  if (!apiKey) {
    return {
      ok: false,
      baseUrl: null,
      message: "EVOLUTION_API_KEY is not set on the frontend server.",
      apiKeyValid: false,
    };
  }

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      const text = await response.text();

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          baseUrl,
          message:
            "EVOLUTION_API_KEY is invalid. It must match AUTHENTICATION_API_KEY on evolution-api.",
          apiKeyValid: false,
        };
      }

      if (response.ok && !isHtmlPayload(text)) {
        return {
          ok: true,
          baseUrl,
          message: "Evolution API authenticated and reachable",
          apiKeyValid: true,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    baseUrl: null,
    message: "Could not reach Evolution API from the frontend container.",
    apiKeyValid: undefined,
  };
}

export async function createEvolutionInstance(instanceName: string): Promise<void> {
  const CREATE_TIMEOUT_MS = 45_000;
  const payload: Record<string, unknown> = {
    instanceName,
    integration: INTEGRATION,
    qrcode: true,
  };

  const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    payload.webhook = {
      url: webhookUrl,
      byEvents: true,
      base64: true,
      events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "SEND_MESSAGE"],
    };
  }

  try {
    await evolutionRequest("POST", "/instance/create", payload, CREATE_TIMEOUT_MS);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exist/i.test(message)) {
      throw error;
    }
  }
}

export async function fetchEvolutionInstance(instanceName: string) {
  try {
    const data = await evolutionRequest<unknown>(
      "GET",
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    );

    const rows = Array.isArray(data) ? data : [data];

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const instance = (record.instance ?? record) as Record<string, unknown>;
      if (instance.instanceName === instanceName) {
        return instance;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not found|404/i.test(message)) {
      throw error;
    }
  }

  return null;
}

export async function connectEvolutionInstance(instanceName: string) {
  const CONNECT_TIMEOUT_MS = 45_000;

  return evolutionRequest<unknown>(
    "GET",
    `/instance/connect/${encodeURIComponent(instanceName)}`,
    undefined,
    CONNECT_TIMEOUT_MS,
  );
}

export async function getEvolutionConnectionState(instanceName: string) {
  return evolutionRequest<{
    instance?: { state?: string };
    state?: string;
  }>("GET", `/instance/connectionState/${encodeURIComponent(instanceName)}`);
}

export async function deleteEvolutionInstance(instanceName: string): Promise<void> {
  await evolutionRequest(
    "DELETE",
    `/instance/delete/${encodeURIComponent(instanceName)}`,
  );
}

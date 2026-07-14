const INTEGRATION = "WHATSAPP-BAILEYS";
const REQUEST_TIMEOUT_MS = 8_000;

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
}

function getEvolutionBaseUrlCandidates(): string[] {
  const envUrl =
    process.env.EVOLUTION_API_URL?.trim() ||
    process.env.EVOLUTION_API_BASE_URL?.trim();

  const candidates = [
    envUrl,
    "http://evolution-api:8080",
    "http://sass-botflow-evolution-api:8080",
    "http://sass-botflow_botflow-evolution:8080",
    "https://evolution.api.botflow.ink",
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates.map((value) => value.replace(/\/$/, "")))];
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

  const directCandidates = [record.base64, record.qrcode, record.qrCode, record.qr];
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

export function extractQrPairingCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  for (const key of ["qrcode", "qr", "data", "response"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const extracted = extractQrPairingCode(nested);
      if (extracted) return extracted;
    }
  }

  const code = record.code;
  if (typeof code === "string" && code.trim().startsWith("2@")) {
    return code.trim();
  }

  return null;
}

function normalizeQrValue(value: string): string | null {
  if (!value) return null;

  if (value.startsWith("data:image")) {
    return value;
  }

  if (value.startsWith("2@") || value.length < 40) {
    return null;
  }

  return value;
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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
}> {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrls = getEvolutionBaseUrlCandidates();

  if (!apiKey) {
    return {
      ok: false,
      baseUrl: null,
      message: "EVOLUTION_API_KEY is not set on the frontend server.",
    };
  }

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(baseUrl, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      const text = await response.text();

      if (response.ok && !isHtmlPayload(text)) {
        return { ok: true, baseUrl, message: "Evolution API reachable" };
      }
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    baseUrl: null,
    message: "Could not reach Evolution API from the frontend container.",
  };
}

export async function createEvolutionInstance(instanceName: string): Promise<void> {
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
    await evolutionRequest("POST", "/instance/create", payload);
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
  return evolutionRequest<unknown>(
    "GET",
    `/instance/connect/${encodeURIComponent(instanceName)}`,
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

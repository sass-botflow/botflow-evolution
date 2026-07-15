import { auth } from "@clerk/nextjs/server";
import { BackendAuthError } from "@/lib/backend/errors";
import {
  clearCachedQr,
  getCachedQr,
  setCachedQr,
} from "@/lib/whatsapp/evolution-qr-cache";
import {
  isInstanceLocked,
  withInstanceLock,
} from "@/lib/whatsapp/evolution-session-lock";
import {
  connectEvolutionInstance,
  createEvolutionInstance,
  deleteEvolutionInstance,
  deriveInstanceName,
  extractPhone,
  extractProfilePictureFromDetails,
  extractQrImageData,
  fetchEvolutionInstance,
  fetchEvolutionProfilePicture,
  getEvolutionConnectionState,
  getInstanceConnectionStateValue,
  isEvolutionConfigured,
  isInstanceClosedState,
  mapConnectionState,
  resolveWhatsAppJid,
  restartEvolutionInstance,
} from "@/lib/whatsapp/evolution-server";

const QR_EXPIRES_IN_SECONDS = 60;
const QR_WAITING_EXPIRES_IN_SECONDS = 2;

function isTransientEvolutionError(message: string): boolean {
  return /fetch failed|econnrefused|enotfound|timeout|abort|cloudflare|bad gateway|gateway|could not reach|offline|unreachable|starting|not ready|returned html|<!doctype/i.test(
    message,
  );
}

function waitingQrResponse(instanceId: string) {
  return {
    instanceId,
    qrCode: "",
    base64: "",
    expiresIn: QR_WAITING_EXPIRES_IN_SECONDS,
    status: "WAITING_QR" as const,
  };
}

function qrReadyResponse(instanceId: string, qrCode: string) {
  setCachedQr(instanceId, qrCode);

  return {
    instanceId,
    qrCode,
    base64: qrCode,
    expiresIn: QR_EXPIRES_IN_SECONDS,
    status: "WAITING_QR" as const,
  };
}

async function requireUserId(): Promise<string> {
  const authState = await auth({ treatPendingAsSignedOut: false });
  if (!authState.userId) {
    throw new BackendAuthError();
  }
  return authState.userId;
}

function assertOwnedInstance(userId: string, instanceId: string): string {
  const instanceName = deriveInstanceName(userId);
  if (instanceId !== instanceName) {
    throw new Error("You do not have access to this WhatsApp session.");
  }
  return instanceName;
}

async function extractQrFromPayload(payload: unknown): Promise<string | null> {
  if (!payload) return null;
  return extractQrImageData(payload);
}

async function resolveProfilePicture(
  instanceName: string,
  details: Record<string, unknown>,
  phone: string | null,
  isConnected: boolean,
): Promise<string | null> {
  const fromDetails = extractProfilePictureFromDetails(details);
  if (fromDetails) return fromDetails;
  if (!isConnected) return null;

  const jid = resolveWhatsAppJid(details, phone);
  if (!jid) return null;

  return fetchEvolutionProfilePicture(instanceName, jid);
}

async function ensureEvolutionInstance(instanceName: string): Promise<string | null> {
  let existing = await fetchEvolutionInstance(instanceName);

  if (existing) {
    const state = getInstanceConnectionStateValue(existing);

    if (isInstanceClosedState(state)) {
      clearCachedQr(instanceName);
      try {
        await deleteEvolutionInstance(instanceName);
        existing = null;
      } catch {
        // Continue with reconnect attempt.
      }
    } else {
      const cachedQr = await extractQrFromPayload(existing.qrcode ?? existing);
      if (cachedQr) {
        setCachedQr(instanceName, cachedQr);
        return cachedQr;
      }
    }
  }

  if (!existing) {
    const created = await createEvolutionInstance(instanceName);
    const createdQr = await extractQrFromPayload(created);
    if (createdQr) {
      setCachedQr(instanceName, createdQr);
      return createdQr;
    }
  }

  return null;
}

async function fetchQrFromConnect(instanceName: string): Promise<string | null> {
  const connectPayload = await connectEvolutionInstance(instanceName);
  const connectQr = await extractQrFromPayload(connectPayload);
  if (connectQr) return connectQr;

  const refreshed = await fetchEvolutionInstance(instanceName);
  return extractQrFromPayload(refreshed?.qrcode ?? refreshed);
}

async function resolveQrForInstance(instanceName: string): Promise<string | null> {
  const cached = getCachedQr(instanceName);
  if (cached) return cached;

  const existingQr = await ensureEvolutionInstance(instanceName);
  if (existingQr) return existingQr;

  let qrCode = await fetchQrFromConnect(instanceName);
  if (qrCode) return qrCode;

  await restartEvolutionInstance(instanceName);
  qrCode = await fetchQrFromConnect(instanceName);
  return qrCode;
}

async function prepareWhatsAppSession(instanceName: string): Promise<string | null> {
  return withInstanceLock(instanceName, () => resolveQrForInstance(instanceName));
}

export async function evolutionConnectInstanceId() {
  if (!isEvolutionConfigured()) {
    throw new Error("Evolution API is not configured on the frontend server.");
  }

  const userId = await requireUserId();

  return {
    instanceId: deriveInstanceName(userId),
  };
}

export async function evolutionConnect() {
  if (!isEvolutionConfigured()) {
    throw new Error("Evolution API is not configured on the frontend server.");
  }

  const userId = await requireUserId();
  const instanceName = deriveInstanceName(userId);

  try {
    const qrCode = await prepareWhatsAppSession(instanceName);
    if (qrCode) {
      setCachedQr(instanceName, qrCode);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isTransientEvolutionError(message)) {
      throw error;
    }
  }

  return {
    instanceId: instanceName,
    status: "waiting_qr" as const,
  };
}

export async function evolutionGetQr(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

  try {
    const cached = getCachedQr(instanceName);
    if (cached) {
      return qrReadyResponse(instanceId, cached);
    }

    if (isInstanceLocked(instanceName)) {
      return waitingQrResponse(instanceId);
    }

    const qrCode = await withInstanceLock(instanceName, () =>
      resolveQrForInstance(instanceName),
    );

    if (!qrCode) {
      return waitingQrResponse(instanceId);
    }

    return qrReadyResponse(instanceId, qrCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isTransientEvolutionError(message)) {
      return waitingQrResponse(instanceId);
    }

    throw error;
  }
}

export async function evolutionGetStatus(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

  const details = await fetchEvolutionInstance(instanceName);
  if (!details) {
    return {
      instanceId,
      status: "WAITING_QR" as const,
      phone: null,
      phoneNumber: null,
      profileName: null,
      profilePictureUrl: null,
      connectedAt: null,
    };
  }

  let mapped: ReturnType<typeof mapConnectionState> = "WAITING_QR";

  try {
    const state = await getEvolutionConnectionState(instanceName);
    mapped = mapConnectionState(
      state.instance?.state ??
        state.state ??
        getInstanceConnectionStateValue(details),
    );
  } catch {
    mapped = mapConnectionState(getInstanceConnectionStateValue(details));
  }

  if (mapped === "CONNECTED") {
    clearCachedQr(instanceName);
  }

  const phone =
    extractPhone(typeof details.owner === "string" ? details.owner : null) ??
    extractPhone(typeof details.ownerJid === "string" ? details.ownerJid : null) ??
    null;
  const profileName =
    typeof details.profileName === "string" ? details.profileName : null;
  const profilePictureUrl = await resolveProfilePicture(
    instanceName,
    details,
    phone,
    mapped === "CONNECTED",
  );

  return {
    instanceId,
    status: mapped,
    phone,
    phoneNumber: phone,
    profileName,
    profilePictureUrl,
    connectedAt: mapped === "CONNECTED" ? new Date().toISOString() : null,
  };
}

export async function evolutionDelete(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

  clearCachedQr(instanceName);

  try {
    await deleteEvolutionInstance(instanceName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not found|404/i.test(message)) {
      throw error;
    }
  }

  return {
    deleted: true,
    instanceId,
    success: true,
  };
}

export async function evolutionListChannels() {
  if (!isEvolutionConfigured()) {
    return { channels: [] as Array<Record<string, unknown>> };
  }

  const userId = await requireUserId();
  const instanceName = deriveInstanceName(userId);
  const details = await fetchEvolutionInstance(instanceName);

  if (!details) {
    return { channels: [] as Array<Record<string, unknown>> };
  }

  let mapped: ReturnType<typeof mapConnectionState> = "WAITING_QR";

  try {
    const state = await getEvolutionConnectionState(instanceName);
    mapped = mapConnectionState(
      state.instance?.state ??
        state.state ??
        getInstanceConnectionStateValue(details),
    );
  } catch {
    mapped = mapConnectionState(getInstanceConnectionStateValue(details));
  }

  const phone =
    extractPhone(typeof details.owner === "string" ? details.owner : null) ??
    extractPhone(typeof details.ownerJid === "string" ? details.ownerJid : null);

  const profilePictureUrl = await resolveProfilePicture(
    instanceName,
    details,
    phone ?? null,
    mapped === "CONNECTED",
  );

  return {
    channels: [
      {
        id: instanceName,
        provider: "whatsapp",
        status: mapped,
        displayPhoneNumber: phone,
        businessName:
          typeof details.profileName === "string" ? details.profileName : null,
        profilePictureUrl,
        connectedAt: mapped === "CONNECTED" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
        phoneNumberId: instanceName,
      },
    ],
  };
}

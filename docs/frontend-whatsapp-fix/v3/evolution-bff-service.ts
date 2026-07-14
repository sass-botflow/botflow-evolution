import { auth } from "@clerk/nextjs/server";
import { BackendAuthError } from "@/lib/backend/errors";
import {
  connectEvolutionInstance,
  createEvolutionInstance,
  deleteEvolutionInstance,
  deriveInstanceName,
  extractPhone,
  extractQrBase64,
  extractQrPairingCode,
  fetchEvolutionInstance,
  getEvolutionConnectionState,
  isEvolutionConfigured,
  mapConnectionState,
} from "@/lib/whatsapp/evolution-server";
import QRCode from "qrcode";

const QR_EXPIRES_IN_SECONDS = 60;

async function resolveQrImage(qrPayload: unknown): Promise<string | null> {
  const base64 = extractQrBase64(qrPayload);
  if (base64) {
    return base64.startsWith("data:image")
      ? base64
      : `data:image/png;base64,${base64}`;
  }

  const pairingCode = extractQrPairingCode(qrPayload);
  if (!pairingCode) {
    return null;
  }

  return QRCode.toDataURL(pairingCode, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });
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

export async function evolutionConnect() {
  if (!isEvolutionConfigured()) {
    throw new Error("Evolution API is not configured on the frontend server.");
  }

  const userId = await requireUserId();
  const instanceName = deriveInstanceName(userId);

  // Return immediately — QR route creates the Evolution instance (avoids Cloudflare timeout).
  return {
    instanceId: instanceName,
    status: "waiting_qr" as const,
  };
}

export async function evolutionGetQr(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

  let existing = await fetchEvolutionInstance(instanceName);

  if (existing) {
    const state =
      typeof existing.connectionStatus === "object"
        ? (existing.connectionStatus as { state?: string }).state
        : typeof existing.status === "string"
          ? existing.status
          : undefined;

    if (state === "close" || state === "closed") {
      try {
        await deleteEvolutionInstance(instanceName);
        existing = null;
      } catch {
        // Continue with reconnect attempt.
      }
    }
  }

  if (!existing) {
    try {
      await createEvolutionInstance(instanceName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already|exist/i.test(message)) {
        throw error;
      }
    }
  }

  try {
    const state = await getEvolutionConnectionState(instanceName);
    const mapped = mapConnectionState(state.instance?.state ?? state.state);

    if (mapped === "CONNECTED") {
      return {
        instanceId,
        qrCode: "",
        base64: "",
        expiresIn: 0,
        status: "CONNECTED" as const,
      };
    }
  } catch {
    // Instance may still be starting — continue to QR connect.
  }

  const qr = await connectEvolutionInstance(instanceName);
  let qrCode = await resolveQrImage(qr);

  if (!qrCode) {
    const refreshed = await fetchEvolutionInstance(instanceName);
    if (refreshed) {
      qrCode = await resolveQrImage(refreshed.qrcode ?? refreshed);
    }
  }

  if (!qrCode) {
    return {
      instanceId,
      qrCode: "",
      base64: "",
      expiresIn: 5,
      status: "WAITING_QR" as const,
    };
  }

  return {
    instanceId,
    qrCode,
    base64: qrCode,
    expiresIn: QR_EXPIRES_IN_SECONDS,
    status: "WAITING_QR" as const,
  };
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
      connectedAt: null,
    };
  }

  let mapped: ReturnType<typeof mapConnectionState> = "WAITING_QR";

  try {
    const state = await getEvolutionConnectionState(instanceName);
    mapped = mapConnectionState(
      state.instance?.state ??
        state.state ??
        (typeof details.connectionStatus === "object"
          ? (details.connectionStatus as { state?: string }).state
          : undefined) ??
        (typeof details.status === "string" ? details.status : undefined),
    );
  } catch {
    mapped = mapConnectionState(
      typeof details.status === "string" ? details.status : undefined,
    );
  }

  const phone =
    extractPhone(typeof details.owner === "string" ? details.owner : null) ?? null;
  const profileName =
    typeof details.profileName === "string" ? details.profileName : null;

  return {
    instanceId,
    status: mapped,
    phone,
    phoneNumber: phone,
    profileName,
    connectedAt: mapped === "CONNECTED" ? new Date().toISOString() : null,
  };
}

export async function evolutionDelete(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

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

  const state = await getEvolutionConnectionState(instanceName);
  const mapped = mapConnectionState(
    state.instance?.state ??
      state.state ??
      (typeof details.status === "string" ? details.status : undefined),
  );
  const phone = extractPhone(typeof details.owner === "string" ? details.owner : null);

  return {
    channels: [
      {
        id: instanceName,
        provider: "whatsapp",
        status: mapped,
        displayPhoneNumber: phone,
        businessName:
          typeof details.profileName === "string" ? details.profileName : null,
        connectedAt: mapped === "CONNECTED" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
        phoneNumberId: instanceName,
      },
    ],
  };
}

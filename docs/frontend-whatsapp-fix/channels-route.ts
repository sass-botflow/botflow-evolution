import { NextResponse } from "next/server";
import { BackendAuthError } from "@/lib/backend/errors";
import { extractErrorMessage } from "@/lib/backend/extract-error-message";
import { proxyBackendRequest } from "@/lib/backend/proxy";

interface ChannelRecord {
  id: string;
  provider?: string;
  status?: string;
  displayPhoneNumber?: string | null;
  businessName?: string | null;
  connectedAt?: string | null;
  updatedAt?: string | null;
  phoneNumberId?: string | null;
}

function mapWhatsAppSessionToChannel(session: {
  id: string;
  status?: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}): ChannelRecord {
  return {
    id: session.id,
    provider: "whatsapp",
    status: session.status,
    displayPhoneNumber:
      typeof session.phoneNumber === "string" ? session.phoneNumber : null,
    businessName: session.displayName ?? null,
    connectedAt: session.createdAt ?? session.updatedAt ?? null,
    updatedAt: session.updatedAt ?? session.createdAt ?? null,
  };
}

export async function GET() {
  try {
    const [channelsResponse, sessionsResponse] = await Promise.all([
      proxyBackendRequest("/api/channels"),
      proxyBackendRequest("/api/whatsapp/sessions"),
    ]);

    const channelsBody = await channelsResponse.json().catch(() => ({}));
    const sessionsBody = await sessionsResponse.json().catch(() => ({}));

    if (!channelsResponse.ok && !sessionsResponse.ok) {
      return NextResponse.json(
        {
          error: extractErrorMessage(channelsBody, "Failed to load channels."),
        },
        { status: channelsResponse.status },
      );
    }

    const channels = channelsResponse.ok
      ? (Array.isArray(channelsBody)
          ? channelsBody
          : ((channelsBody as { channels?: ChannelRecord[] }).channels ??
            (channelsBody as { data?: ChannelRecord[] }).data ??
            []))
      : [];

    const sessions = sessionsResponse.ok
      ? ((sessionsBody as { sessions?: Array<Record<string, unknown>> }).sessions ??
        [])
      : [];

    const sessionChannels = sessions
      .filter((session) => typeof session.id === "string")
      .map((session) =>
        mapWhatsAppSessionToChannel(
          session as {
            id: string;
            status?: string;
            phoneNumber?: string | null;
            displayName?: string | null;
            updatedAt?: string | null;
            createdAt?: string | null;
          },
        ),
      );

    const merged = new Map<string, ChannelRecord>();
    for (const channel of channels) {
      if (channel?.id) merged.set(channel.id, channel);
    }
    for (const channel of sessionChannels) {
      merged.set(channel.id, channel);
    }

    return NextResponse.json({ channels: Array.from(merged.values()) });
  } catch (err) {
    if (err instanceof BackendAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load channels." }, { status: 500 });
  }
}

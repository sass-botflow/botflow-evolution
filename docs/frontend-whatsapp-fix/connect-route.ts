import { NextResponse } from "next/server";
import { BackendAuthError } from "@/lib/backend/errors";
import { extractErrorMessage } from "@/lib/backend/extract-error-message";
import { mapSessionToConnectResponse } from "@/lib/backend/whatsapp-sessions-compat";
import { proxyBackendRequest } from "@/lib/backend/proxy";

export async function POST() {
  try {
    const response = await proxyBackendRequest("/api/whatsapp/sessions", {
      method: "POST",
      body: JSON.stringify({ displayName: "WhatsApp Business" }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: extractErrorMessage(body, "Failed to create WhatsApp session."),
          message:
            body && typeof body === "object" && "message" in body
              ? String((body as { message: unknown }).message)
              : undefined,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(mapSessionToConnectResponse(body));
  } catch (err) {
    if (err instanceof BackendAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create WhatsApp session." },
      { status: 500 },
    );
  }
}

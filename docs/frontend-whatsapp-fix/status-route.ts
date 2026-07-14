import { NextResponse } from "next/server";
import { BackendAuthError } from "@/lib/backend/errors";
import { extractErrorMessage } from "@/lib/backend/extract-error-message";
import { mapSessionStatusResponse } from "@/lib/backend/whatsapp-sessions-compat";
import { proxyBackendRequest } from "@/lib/backend/proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await context.params;

  try {
    const response = await proxyBackendRequest(
      `/api/whatsapp/sessions/${encodeURIComponent(instanceId)}/status`,
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: extractErrorMessage(body, "Failed to load WhatsApp status."),
        },
        { status: response.status },
      );
    }

    return NextResponse.json(mapSessionStatusResponse(body));
  } catch (err) {
    if (err instanceof BackendAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to load WhatsApp status." },
      { status: 500 },
    );
  }
}

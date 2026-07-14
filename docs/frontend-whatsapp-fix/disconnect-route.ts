import { proxyBackendJson } from "@/lib/backend/proxy";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await context.params;

  // Production backend exposes disconnect on /api/channels/:id, not sessions DELETE.
  return proxyBackendJson(
    `/api/channels/${encodeURIComponent(instanceId)}/disconnect`,
    { method: "POST" },
  );
}

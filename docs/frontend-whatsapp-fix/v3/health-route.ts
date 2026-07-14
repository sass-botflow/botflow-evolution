import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { getBackendApiUrl, getConfiguredBackendApiUrl } from "@/lib/backend/config";
import {
  getEvolutionBaseUrls,
  isEvolutionConfigured,
  testEvolutionConnectivity,
} from "@/lib/whatsapp/evolution-server";

export const dynamic = "force-dynamic";

function readBuildFile(name: string): string | null {
  try {
    const value = readFileSync(join(process.cwd(), name), "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function getVersion(): string {
  const fromFile = readBuildFile("BUILD_VERSION.txt");
  if (fromFile) return fromFile;
  return process.env.APP_VERSION ?? "dev";
}

function getBuildTime(): string | null {
  return readBuildFile("BUILD_TIME.txt") ?? process.env.BUILD_TIME ?? null;
}

function getDeployHint(version: string, buildTime: string | null): string | null {
  if (version === "dev") {
    return "Deploy ma kheddamch — Source = GitHub + Dockerfile, w stana 5-10 d9aya (mashi 2 thaniya).";
  }
  if (!buildTime) return null;
  const ageHours = (Date.now() - new Date(buildTime).getTime()) / 3_600_000;
  if (ageHours > 6) {
    return `Build 9dim (${Math.floor(ageHours)}h). EasyPanel Deploy f 2s = restart ghir. Source → GitHub → Deploy w stana 10 d9aya.`;
  }
  return null;
}

export async function GET() {
  const version = getVersion();
  const buildTime = getBuildTime();
  const deployHint = getDeployHint(version, buildTime);
  const configuredBackendUrl = getConfiguredBackendApiUrl();
  const resolvedBackendUrl = getBackendApiUrl();

  let backendHealth: Record<string, unknown> | null = null;
  let backendReachable = false;

  try {
    const response = await fetch(getBackendApiUrl("/health"), {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    backendReachable = response.ok;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      backendHealth = (await response.json()) as Record<string, unknown>;
    }
  } catch {
    backendReachable = false;
  }

  const misconfiguredApiUrl =
    configuredBackendUrl !== resolvedBackendUrl &&
    /botflow\.ink/i.test(configuredBackendUrl);

  const config = backendHealth?.config as Record<string, unknown> | undefined;
  const evolution = isEvolutionConfigured()
    ? await testEvolutionConnectivity()
    : { ok: false, baseUrl: null, message: "EVOLUTION_API_KEY not set" };

  return NextResponse.json(
    {
      status: backendReachable && evolution.ok ? "ok" : "degraded",
      service: "botflow-frontend",
      version,
      buildTime,
      deployHint,
      persistence: "backend-api",
      whatsappProvider: "evolution-api",
      evolutionBff: isEvolutionConfigured(),
      evolutionUrls: getEvolutionBaseUrls(),
      evolution,
      backend: {
        configuredUrl: configuredBackendUrl,
        resolvedUrl: resolvedBackendUrl,
        reachable: backendReachable,
        misconfiguredApiUrl,
        buildCommit: backendHealth?.buildCommit ?? null,
        meta: config?.meta ?? null,
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

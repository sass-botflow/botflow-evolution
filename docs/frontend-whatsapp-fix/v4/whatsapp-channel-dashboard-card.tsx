"use client";

import { motion } from "framer-motion";
import {
  Clock3,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Unlink,
  UserRound,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/channels/channel-logo";
import { ChannelStatusBadge } from "@/components/channels/channel-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { WhatsAppChannel } from "@/lib/whatsapp/evolution-types";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface WhatsAppChannelDashboardCardProps {
  channel: WhatsAppChannel;
  index?: number;
  loading?: boolean;
  onDisconnect: (channel: WhatsAppChannel) => void;
  onReconnect: (channel: WhatsAppChannel) => void;
}

export function WhatsAppChannelDashboardCard({
  channel,
  index = 0,
  loading = false,
  onDisconnect,
  onReconnect,
}: WhatsAppChannelDashboardCardProps) {
  const isConnected = channel.status === "CONNECTED";
  const statusLabel = isConnected ? "connected" : "disconnected";
  const displayName = channel.profileName ?? "WhatsApp Business";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-6 shadow-lg shadow-black/5 backdrop-blur-xl transition-all hover:border-emerald-500/25 hover:shadow-emerald-500/5 sm:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,211,102,0.06),transparent_55%)] opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 rounded-2xl ring-2 ring-emerald-500/20">
                {channel.profilePictureUrl ? (
                  <AvatarImage
                    src={channel.profilePictureUrl}
                    alt={displayName}
                    className="rounded-2xl object-cover"
                  />
                ) : null}
                <AvatarFallback className="rounded-2xl bg-emerald-500/15 text-base font-semibold text-emerald-400">
                  {initials || "WA"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366] shadow-md">
                <WhatsAppIcon className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold tracking-tight">{displayName}</h3>
                <ChannelStatusBadge status={statusLabel} />
              </div>
              <p className="text-sm text-muted-foreground">
                {channel.phoneNumber ?? "Waiting for phone number"}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Button
              size="lg"
              variant="outline"
              disabled={loading}
              className="h-11 rounded-xl border-border/70 bg-background/40 font-semibold backdrop-blur"
              onClick={() => onReconnect(channel)}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={loading}
              className="h-11 rounded-xl border-border/70 bg-background/40 font-semibold backdrop-blur hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
              onClick={() => onDisconnect(channel)}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Unlink className="h-4 w-4" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={Phone}
            label="Phone"
            value={channel.phoneNumber ?? "—"}
          />
          <MetricTile
            icon={UserRound}
            label="Profile"
            value={channel.profileName ?? "—"}
            imageUrl={channel.profilePictureUrl}
          />
          <MetricTile
            icon={Clock3}
            label="Last Seen"
            value={
              channel.lastSeen
                ? formatRelativeTime(channel.lastSeen)
                : channel.connectedAt
                  ? formatRelativeTime(channel.connectedAt)
                  : "—"
            }
          />
          <MetricTile
            icon={MessageSquare}
            label="Messages Today"
            value={String(channel.messagesToday ?? 0)}
            accent="text-emerald-400"
          />
        </div>
      </div>
    </motion.article>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  accent,
  imageUrl,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  accent?: string;
  imageUrl?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/30 p-4 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-500/10">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-4 w-4 text-emerald-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-1 truncate text-sm font-semibold", accent)} title={value}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

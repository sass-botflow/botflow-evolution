"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/channels/channel-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useWhatsAppQrSession } from "@/hooks/use-whatsapp-evolution";
import type { WhatsAppChannel } from "@/lib/whatsapp/evolution-types";
import { formatRelativeTime } from "@/lib/utils";

const SCAN_STEPS = [
  "Open WhatsApp",
  "Settings",
  "Linked Devices",
  "Link Device",
  "Scan QR",
] as const;

interface WhatsAppQrModalProps {
  open: boolean;
  instanceId: string | null;
  connecting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (channel: WhatsAppChannel) => void;
}

export function WhatsAppQrModal({
  open,
  instanceId,
  connecting = false,
  onOpenChange,
  onConnected,
}: WhatsAppQrModalProps) {
  const session = useWhatsAppQrSession({
    instanceId,
    enabled: open && Boolean(instanceId),
    onConnected: (channel) => {
      onConnected(channel);
    },
  });

  const showSuccess = session.isConnected;
  const hasError = Boolean(session.errorCode);
  const showQrLoading =
    !hasError &&
    (connecting ||
      session.isLoadingQr ||
      (!session.qrImageSrc && !showSuccess));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-border/60 bg-card/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 px-6 py-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {showSuccess ? "WhatsApp Connected" : "Scan QR Code"}
            </DialogTitle>
            <DialogDescription>
              {showSuccess
                ? "Your WhatsApp number is linked and ready for automation."
                : "Use WhatsApp on your phone to scan the code below."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-6">
          <AnimatePresence mode="wait">
            {showSuccess ? (
              <ConnectedPanel
                key="connected"
                phoneNumber={session.phoneNumber}
                profileName={session.profileName}
                profilePictureUrl={session.profilePictureUrl}
                connectedAt={session.connectedAt}
                onClose={() => onOpenChange(false)}
              />
            ) : (
              <motion.div
                key="qr"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {hasError ? (
                  <WhatsAppErrorState
                    code={session.errorCode!}
                    detail={session.errorDetail}
                    onRetry={() => {
                      session.resetError();
                      void session.refetchQr();
                    }}
                  />
                ) : (
                  <>
                    <div className="flex flex-col items-center">
                      <div className="relative rounded-[28px] border-[6px] border-zinc-900 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
                        {session.qrImageSrc ? (
                          <motion.img
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            src={session.qrImageSrc}
                            alt="WhatsApp QR code"
                            className="h-64 w-64 rounded-2xl object-contain sm:h-72 sm:w-72"
                          />
                        ) : showQrLoading ? (
                          <div className="flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                            <div className="space-y-4 text-center">
                              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#25D366]" />
                              <p className="text-sm text-muted-foreground">
                                {connecting
                                  ? "Starting WhatsApp session..."
                                  : "Generating QR code..."}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                            <p className="px-4 text-center text-sm text-muted-foreground">
                              QR code unavailable. Close and try again.
                            </p>
                          </div>
                        )}

                        {session.isFetchingQr && session.qrImageSrc ? (
                          <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-background/70 backdrop-blur-sm">
                            <RefreshCw className="h-6 w-6 animate-spin text-[#25D366]" />
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        {session.secondsLeft !== null ? (
                          <>
                            <span className="font-medium text-foreground">
                              {session.secondsLeft}s
                            </span>
                            <span>until QR refreshes automatically</span>
                          </>
                        ) : (
                          <Skeleton className="h-4 w-40" />
                        )}
                      </div>
                    </div>

                    <ol className="mx-auto grid max-w-md gap-2 sm:grid-cols-5">
                      {SCAN_STEPS.map((step, index) => (
                        <li
                          key={step}
                          className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-center text-xs font-medium text-muted-foreground"
                        >
                          <span className="mb-1 block text-[10px] uppercase tracking-wide text-[#25D366]">
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>

                    <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
                      {session.status === "CONNECTING"
                        ? "QR scanned — finishing connection..."
                        : "Waiting for QR scan..."}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConnectedPanel({
  phoneNumber,
  profileName,
  profilePictureUrl,
  connectedAt,
  onClose,
}: {
  phoneNumber?: string | null;
  profileName?: string | null;
  profilePictureUrl?: string | null;
  connectedAt?: string | null;
  onClose: () => void;
}) {
  const displayName = profileName ?? "WhatsApp User";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 text-center"
    >
      <div className="relative mx-auto w-fit">
        <Avatar className="h-20 w-20 rounded-full ring-2 ring-emerald-500/30">
          {profilePictureUrl ? (
            <AvatarImage
              src={profilePictureUrl}
              alt={displayName}
              className="rounded-full object-cover"
            />
          ) : null}
          <AvatarFallback className="rounded-full bg-emerald-500/15 text-lg font-semibold text-emerald-400">
            {initials || "WA"}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] shadow-md">
          <WhatsAppIcon className="h-4 w-4 text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-semibold tracking-tight">WhatsApp Connected</h3>
        <p className="text-sm text-muted-foreground">
          Your number is live and ready to receive automated replies.
        </p>
      </div>

      <div className="grid gap-3 text-left">
        <InfoRow icon={UserRound} label="Profile" value={profileName ?? "WhatsApp User"} />
        <InfoRow icon={Phone} label="Phone Number" value={phoneNumber ?? "—"} />
        <InfoRow
          icon={CheckCircle2}
          label="Connected Since"
          value={
            connectedAt
              ? formatRelativeTime(connectedAt)
              : "Just now"
          }
        />
      </div>

      <Button
        type="button"
        onClick={onClose}
        className="h-11 w-full rounded-xl bg-[#25D366] font-semibold text-white hover:bg-[#1fb855]"
      >
        Done
      </Button>
    </motion.div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
        <Icon className="h-4 w-4 text-emerald-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

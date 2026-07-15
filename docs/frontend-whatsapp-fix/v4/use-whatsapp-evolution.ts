"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  connectWhatsAppInstance,
  disconnectWhatsAppInstance,
  fetchWhatsAppQr,
  fetchWhatsAppStatus,
} from "@/lib/whatsapp/evolution-api";
import { whatsappQueryKeys } from "@/lib/whatsapp/evolution-query-keys";
import {
  normalizeWhatsAppStatus,
  resolveQrImageSrc,
  WHATSAPP_QR_POLL_MS,
  WHATSAPP_QR_POLL_MS_WAITING,
  WHATSAPP_STATUS_POLL_MS,
  mapApiErrorToWhatsAppCode,
  type WhatsAppChannel,
  type WhatsAppConnectErrorCode,
  type WhatsAppInstanceStatus,
} from "@/lib/whatsapp/evolution-types";

export function useWhatsAppChannels() {
  return useQuery({
    queryKey: whatsappQueryKeys.channels(),
    queryFn: async (): Promise<WhatsAppChannel[]> => {
      const response = await fetch("/api/channels", { cache: "no-store" });
      const body = (await response.json()) as {
        channels?: Array<{
          id: string;
          provider: string;
          status: string;
          displayPhoneNumber?: string;
          businessName?: string | null;
          profilePictureUrl?: string | null;
          connectedAt?: string | null;
          updatedAt?: string;
          phoneNumberId?: string;
        }>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load WhatsApp channels.");
      }

      return (body.channels ?? [])
        .filter((channel) => channel.provider === "whatsapp")
        .map((channel) => ({
          instanceId: channel.id,
          status: normalizeWhatsAppStatus(channel.status),
          phoneNumber: channel.displayPhoneNumber ?? channel.phoneNumberId ?? null,
          profileName: channel.businessName ?? null,
          profilePictureUrl: channel.profilePictureUrl ?? null,
          connectedAt: channel.connectedAt ?? channel.updatedAt ?? null,
          lastSeen: channel.updatedAt ?? null,
          messagesToday: 0,
        }));
    },
  });
}

export function useWhatsAppConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: connectWhatsAppInstance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: whatsappQueryKeys.all });
    },
  });
}

export function useWhatsAppDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectWhatsAppInstance,
    onMutate: async (instanceId) => {
      await queryClient.cancelQueries({ queryKey: whatsappQueryKeys.channels() });
      const previous = queryClient.getQueryData<WhatsAppChannel[]>(
        whatsappQueryKeys.channels(),
      );

      queryClient.setQueryData<WhatsAppChannel[]>(
        whatsappQueryKeys.channels(),
        (current) => current?.filter((item) => item.instanceId !== instanceId) ?? [],
      );

      return { previous };
    },
    onError: (_error, _instanceId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          whatsappQueryKeys.channels(),
          context.previous,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: whatsappQueryKeys.all });
    },
  });
}

interface UseWhatsAppQrSessionOptions {
  instanceId: string | null;
  enabled: boolean;
  onConnected?: (status: WhatsAppChannel) => void;
}

export function useWhatsAppQrSession({
  instanceId,
  enabled,
  onConnected,
}: UseWhatsAppQrSessionOptions) {
  const queryClient = useQueryClient();
  const [errorCode, setErrorCode] = useState<WhatsAppConnectErrorCode | null>(
    null,
  );
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const statusQuery = useQuery({
    queryKey: whatsappQueryKeys.status(instanceId ?? "none"),
    queryFn: () => fetchWhatsAppStatus(instanceId!),
    enabled: enabled && Boolean(instanceId),
    refetchInterval: (query) => {
      const status = normalizeWhatsAppStatus(query.state.data?.status);
      if (status === "CONNECTED" || status === "DISCONNECTED") return false;
      return WHATSAPP_STATUS_POLL_MS;
    },
  });

  const status = normalizeWhatsAppStatus(statusQuery.data?.status);
  const isConnected = status === "CONNECTED";
  const shouldPollQr = enabled && Boolean(instanceId) && !isConnected;

  const qrQuery = useQuery({
    queryKey: whatsappQueryKeys.qr(instanceId ?? "none"),
    queryFn: () => fetchWhatsAppQr(instanceId!),
    enabled: shouldPollQr,
    refetchInterval: (query) => {
      if (!shouldPollQr) return false;
      const hasQr = Boolean(resolveQrImageSrc(query.state.data));
      return hasQr ? WHATSAPP_QR_POLL_MS : WHATSAPP_QR_POLL_MS_WAITING;
    },
    retry: (failureCount, error) => {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (
        message.includes("not available") ||
        message.includes("waiting") ||
        message.includes("temporarily unavailable")
      ) {
        return failureCount < 20;
      }
      return failureCount < 5;
    },
  });

  const qrImageSrc = useMemo(
    () => resolveQrImageSrc(qrQuery.data),
    [qrQuery.data],
  );

  useEffect(() => {
    if (!qrQuery.data) return;

    const ttl = qrQuery.data.expiresIn ?? 60;
    const nextExpiresAt = qrQuery.data.expiresAt
      ? new Date(qrQuery.data.expiresAt).getTime()
      : Date.now() + ttl * 1000;

    setExpiresAt(nextExpiresAt);
    setSecondsLeft(Math.max(0, Math.ceil((nextExpiresAt - Date.now()) / 1000)));
  }, [qrQuery.data]);

  useEffect(() => {
    if (!expiresAt || isConnected) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0 && shouldPollQr) {
        void qrQuery.refetch();
      }
    }, 1_000);

    return () => clearInterval(timer);
  }, [expiresAt, isConnected, qrQuery, shouldPollQr]);

  useEffect(() => {
    if (!isConnected || !instanceId || !statusQuery.data) return;

    const channel: WhatsAppChannel = {
      instanceId,
      status: "CONNECTED",
      phoneNumber: statusQuery.data.phoneNumber ?? null,
      profileName: statusQuery.data.profileName ?? null,
      profilePictureUrl: statusQuery.data.profilePictureUrl ?? null,
      connectedAt: statusQuery.data.connectedAt ?? new Date().toISOString(),
      lastSeen: statusQuery.data.lastSeen ?? null,
      messagesToday: statusQuery.data.messagesToday ?? 0,
    };

    void queryClient.invalidateQueries({ queryKey: whatsappQueryKeys.channels() });
    onConnected?.(channel);
  }, [instanceId, isConnected, onConnected, queryClient, statusQuery.data]);

  const resolveError = useCallback((): WhatsAppConnectErrorCode | null => {
    if (qrQuery.isFetching) return null;
    if (errorCode) return errorCode;

    const message =
      qrQuery.error instanceof Error
        ? qrQuery.error.message
        : null;

    if (!message) return null;
    return mapApiErrorToWhatsAppCode(message);
  }, [errorCode, qrQuery.error, qrQuery.isFetching]);

  const resolveErrorDetail = useCallback((): string | null => {
    if (qrQuery.error instanceof Error) {
      return qrQuery.error.message;
    }
    return null;
  }, [qrQuery.error]);

  useEffect(() => {
    if (qrQuery.isFetching) {
      setErrorCode(null);
      return;
    }

    const message =
      qrQuery.error instanceof Error
        ? qrQuery.error.message
        : null;

    if (message) {
      setErrorCode(mapApiErrorToWhatsAppCode(message));
    }
  }, [qrQuery.error, qrQuery.isFetching]);

  return {
    qrImageSrc,
    status: status as WhatsAppInstanceStatus,
    secondsLeft,
    isLoadingQr:
      qrQuery.isLoading ||
      (qrQuery.isFetching && !qrImageSrc && !qrQuery.isError),
    isLoading: qrQuery.isLoading || statusQuery.isLoading,
    isFetchingQr: qrQuery.isFetching,
    isConnected,
    errorCode: resolveError(),
    errorDetail: resolveErrorDetail(),
    profileName: statusQuery.data?.profileName ?? null,
    profilePictureUrl: statusQuery.data?.profilePictureUrl ?? null,
    phoneNumber: statusQuery.data?.phoneNumber ?? null,
    connectedAt: statusQuery.data?.connectedAt ?? null,
    refetchQr: qrQuery.refetch,
    resetError: () => setErrorCode(null),
  };
}

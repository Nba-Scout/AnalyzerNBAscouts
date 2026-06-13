// Hooks TanStack Query — fonte única de dados da API.
// useProps com refetchInterval substitui o RefreshCountdown/setInterval do legado.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PlayerDetail, PropsResponse, RefreshResponse, StatusResponse } from "../types/api";
import { apiGet, apiPost } from "./client";

export const queryKeys = {
  props: ["props"] as const,
  player: (name: string) => ["player", name] as const,
  status: ["status"] as const,
};

export function useProps() {
  return useQuery({
    queryKey: queryKeys.props,
    queryFn: () => apiGet<PropsResponse>("/props"),
    refetchInterval: 5 * 60 * 1000, // 5min
    staleTime: 60 * 1000,
  });
}

export function usePlayer(name: string | undefined) {
  return useQuery({
    queryKey: queryKeys.player(name ?? ""),
    queryFn: () => apiGet<PlayerDetail>(`/player/${encodeURIComponent(name ?? "")}`),
    enabled: !!name,
  });
}

export function useStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: () => apiGet<StatusResponse>("/status"),
    refetchInterval: 30 * 1000,
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<RefreshResponse>("/refresh"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.props });
      void qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}

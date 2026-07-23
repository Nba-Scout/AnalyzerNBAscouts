// Hooks TanStack Query — fonte única de dados da API.
// useProps com refetchInterval substitui o RefreshCountdown/setInterval do legado.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Bet, BetCreate, BetSettle, LineHistoryResponse, PlayerDetail, PropsResponse, RefreshResponse } from "../types/api";
import { apiGet, apiPatch, apiPost } from "./client";

export const queryKeys = {
  props: ["props"] as const,
  player: (name: string) => ["player", name] as const,
  bets: ["bets"] as const,
  lineHistory: (player: string, market: string, direction: string) => ["lineHistory", player, market, direction] as const,
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

/**
 * Série temporal da linha de uma prop (movimento intraday). `direction` vem em
 * maiúsculo no contrato de props; o backend guarda em minúsculo → normaliza aqui.
 * `enabled` só dispara quando o painel da prop está aberto (evita N chamadas).
 */
export function useLineHistory(player: string, marketKey: string, direction: string, enabled: boolean) {
  const dir = direction.toLowerCase();
  return useQuery({
    queryKey: queryKeys.lineHistory(player, marketKey, dir),
    queryFn: () =>
      apiGet<LineHistoryResponse>(
        `/line-history?player=${encodeURIComponent(player)}&market=${encodeURIComponent(marketKey)}&direction=${encodeURIComponent(dir)}`,
      ),
    enabled: enabled && !!player && !!marketKey,
    staleTime: 60 * 1000,
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<RefreshResponse>("/refresh"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.props });
    },
  });
}

// ─── Bet tracker (carteira) — consome o CRUD /api/bets já existente no backend ──

export function useBets() {
  return useQuery({
    queryKey: queryKeys.bets,
    queryFn: () => apiGet<Bet[]>("/bets"),
    staleTime: 30 * 1000,
  });
}

export function useAddBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BetCreate) => apiPost<Bet>("/bets", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bets });
    },
  });
}

export function useSettleBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, result }: { id: number } & BetSettle) => apiPatch<Bet>(`/bets/${id}`, { result }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bets });
    },
  });
}

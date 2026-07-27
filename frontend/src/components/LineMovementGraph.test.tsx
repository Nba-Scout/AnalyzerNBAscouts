// Estados do LineMovementGraph por nº de pontos e por variant. O reuso nos cards
// (C2) depende de dois comportamentos que o AccordionPanel não exercitava: não
// renderizar NADA sem série (variant="card") e um id de gradiente único por
// instância (N gráficos na mesma página).
//
// useLineHistory é mockado — o objetivo aqui é o contrato de renderização do
// componente, não a camada de rede.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LineHistoryPoint, LineHistoryResponse } from "../types/api";

const mockQuery = vi.hoisted(() => vi.fn());

vi.mock("../api/queries", () => ({ useLineHistory: mockQuery }));

const { LineMovementGraph } = await import("./LineMovementGraph");

function pt(line: number, hh: number): LineHistoryPoint {
  return { captured_at: `2026-06-11T${String(hh).padStart(2, "0")}:00:00Z`, line, odd: 1.9 };
}

function mockPoints(points: LineHistoryPoint[], isLoading = false) {
  const data: LineHistoryResponse = { player_name: "Nikola Jokic", market: "Pontos", direction: "over", points };
  mockQuery.mockReturnValue({ data: isLoading ? undefined : data, isLoading });
}

function renderGraph(variant: "panel" | "card", active = true) {
  return render(
    <LineMovementGraph player="Nikola Jokic" marketKey="player_points" direction="OVER" active={active} variant={variant} />,
  );
}

afterEach(() => {
  cleanup();
  mockQuery.mockReset();
});

describe("LineMovementGraph", () => {
  describe("variant=card (cards do Dashboard e da página Player)", () => {
    it("renders nothing with zero points", () => {
      mockPoints([]);
      const { container } = renderGraph("card");
      expect(container.innerHTML).toBe("");
    });

    it("renders nothing with a single point", () => {
      mockPoints([pt(26.5, 12)]);
      const { container } = renderGraph("card");
      expect(container.innerHTML).toBe("");
    });

    it("renders nothing while loading (sem texto de placeholder no card)", () => {
      mockPoints([], true);
      const { container } = renderGraph("card");
      expect(container.innerHTML).toBe("");
    });

    it("renders the chart with two or more points", () => {
      mockPoints([pt(26.5, 9), pt(27.5, 12)]);
      renderGraph("card");
      expect(screen.getByRole("img", { name: /movimento da linha/i })).toBeTruthy();
    });

    it("escala pelo viewBox em vez de largura fixa", () => {
      mockPoints([pt(26.5, 9), pt(27.5, 12)]);
      renderGraph("card");
      const svg = screen.getByRole("img", { name: /movimento da linha/i });
      expect(svg.getAttribute("viewBox")).toBe("0 0 240 72");
      expect(svg.getAttribute("width")).toBeNull();
    });
  });

  describe("variant=panel (AccordionPanel — comportamento preservado)", () => {
    it("keeps the empty-state text with zero points", () => {
      mockPoints([]);
      renderGraph("panel");
      expect(screen.getByText(/sem histórico de movimento/i)).toBeTruthy();
    });

    it("keeps the single-reading text with one point", () => {
      mockPoints([pt(26.5, 12)]);
      renderGraph("panel");
      expect(screen.getByText(/só 1 leitura/i)).toBeTruthy();
    });

    it("keeps the loading text", () => {
      mockPoints([], true);
      renderGraph("panel");
      expect(screen.getByText(/carregando movimento/i)).toBeTruthy();
    });

    it("usa largura fixa (não escala)", () => {
      mockPoints([pt(26.5, 9), pt(27.5, 12)]);
      renderGraph("panel");
      const svg = screen.getByRole("img", { name: /movimento da linha/i });
      expect(svg.getAttribute("width")).toBe("240");
      expect(svg.getAttribute("viewBox")).toBeNull();
    });
  });

  it("does not render when inactive", () => {
    mockPoints([pt(26.5, 9), pt(27.5, 12)]);
    const { container } = renderGraph("card", false);
    expect(container.innerHTML).toBe("");
  });

  it("mostra o delta da linha entre o primeiro e o último ponto", () => {
    mockPoints([pt(26.5, 9), pt(27.0, 12), pt(27.5, 15)]);
    renderGraph("card");
    expect(screen.getByText("▲ +1")).toBeTruthy();
  });

  it("dá um id de gradiente único por instância (ids duplicados quebram o fill em grid)", () => {
    mockPoints([pt(26.5, 9), pt(27.5, 12)]);
    const { container: a } = renderGraph("card");
    const { container: b } = renderGraph("card");

    const idOf = (c: HTMLElement) => c.querySelector("linearGradient")?.getAttribute("id");
    expect(idOf(a)).toBeTruthy();
    expect(idOf(b)).toBeTruthy();
    expect(idOf(a)).not.toBe(idOf(b));
    // o path precisa referenciar o próprio gradiente, não o da outra instância
    expect(a.querySelector("path")?.getAttribute("fill")).toBe(`url(#${idOf(a)})`);
  });
});

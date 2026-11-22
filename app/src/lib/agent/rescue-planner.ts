import { llmConfig, runToolLoop, type Tool } from "./llm";
import type { RescueActions } from "./rescue-actions";

function systemPrompt(pass: "primera" | "segunda") {
  return [
    "Eres el Agente Retta. Tu meta es que una reta de fútbol junte su mínimo de jugadores antes de su hora de cierre; si no lo junta, se cancela.",
    `Esta es tu ${pass} pasada sobre la reta.`,
    "Usa las herramientas. Invita solo a jugadores que te regrese buscar_jugadores, y no más de los necesarios con un margen razonable.",
    "Extiende el cierre solo si da más tiempo real. Propón otro horario solo si tiene más jugadores afines que los que faltan.",
    "Cuando no quede nada útil por hacer, llama a terminar.",
  ].join(" ");
}

const terminate: Tool = {
  name: "terminar",
  description: "Termina esta pasada cuando ya no haya nada útil que hacer.",
  parameters: { type: "object", properties: { resumen: { type: "string" } } },
  run: async () => ({ ok: true }),
};

/** Asks the model to plan the pass; on any failure, or without a model, runs the rules. */
export async function plan(pass: "primera" | "segunda", actions: RescueActions, missing: number, rules: () => Promise<void>) {
  if (llmConfig()) {
    try {
      return await runToolLoop(systemPrompt(pass), actions.situation(), modelTools(actions, missing, pass));
    } catch (error) {
      // Fall through to the rules; whatever the model already did stays done.
      console.error("[agente] LLM failed, using rules:", error instanceof Error ? error.message : error);
    }
  }
  await rules();
  return "rules";
}

function modelTools(actions: RescueActions, missing: number, pass: "primera" | "segunda"): Tool[] {
  function searchTool(): Tool {
    return {
      name: "buscar_jugadores",
      description: "Busca jugadores afines que no están inscritos ni ocupados a esa hora, ordenados por afinidad.",
      parameters: { type: "object", properties: { limite: { type: "integer", description: "Cuántos, máximo 10" } } },
      run: async (args) => {
        const list = await actions.search(Number(args.limite) || missing * 2);
        return list.map((c) => ({ id: c.id, misma_cancha: c.same_field, misma_hora: c.same_hour, asistencias: c.attended }));
      },
    };
  }

  function inviteTool(): Tool {
    return {
      name: "invitar",
      description: "Manda una invitación a la reta a los jugadores indicados.",
      parameters: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
      run: async (args) => actions.invite(Array.isArray(args.ids) ? (args.ids as string[]) : []),
    };
  }

  function extendTool(): Tool {
    return {
      name: "extender_cierre",
      description: "Mueve la hora de cierre lo más tarde posible (1 h antes de empezar).",
      parameters: { type: "object", properties: {} },
      run: async () => actions.extend(),
    };
  }

  function optionsTool(): Tool {
    return {
      name: "buscar_horarios",
      description: "Lista horarios libres el mismo día, cerca de la hora original, con cuántos jugadores afines tiene cada cancha.",
      parameters: { type: "object", properties: {} },
      run: async () => actions.options(),
    };
  }

  function proposeTool(): Tool {
    return {
      name: "proponer_horario",
      description: "Propone al organizador mover la reta a uno de los horarios de buscar_horarios. Nada cambia sin su aprobación.",
      parameters: {
        type: "object",
        properties: { slot_id: { type: "string" }, motivo: { type: "string", description: "Una frase para el organizador" } },
        required: ["slot_id", "motivo"],
      },
      run: async (args) => actions.propose(String(args.slot_id), String(args.motivo ?? "")),
    };
  }
  return [searchTool(), inviteTool(), ...(pass === "primera" ? [extendTool()] : [optionsTool(), proposeTool()]), terminate];
}

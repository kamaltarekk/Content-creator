import type { ContentObjective } from "@prisma/client";

import type { ScriptGenerationContext } from "@/server/domain/script-generation-context";

/**
 * The Create First Reel flow never asks the user for funnel stage, cognitive
 * objective, or similar strategy jargon (spec: "the system infers ... never
 * asks the user for these") — this infers a plain-language strategic
 * direction from the content objective the user DID pick, purely as an
 * upfront preview before generation runs.
 */
export type StrategicDirectionPreview = {
  funnelStage: string;
  cognitiveObjective: string;
  summary: string;
};

const FUNNEL_STAGE_BY_OBJECTIVE: Record<ContentObjective, string> = {
  AWARENESS: "Top of funnel — first contact",
  EDUCATION: "Top to mid funnel — building understanding",
  TRUST: "Mid funnel — building credibility",
  BELIEF_CHANGE: "Mid funnel — reframing a belief",
  OBJECTION_HANDLING: "Bottom of funnel — clearing a blocker",
  OFFER_PROMOTION: "Bottom of funnel — commercial ask",
};

const COGNITIVE_OBJECTIVE_BY_OBJECTIVE: Record<ContentObjective, string> = {
  AWARENESS: "Get noticed and remembered",
  EDUCATION: "Teach something true and useful",
  TRUST: "Demonstrate credibility and expertise",
  BELIEF_CHANGE: "Replace a wrong belief with a better one",
  OBJECTION_HANDLING: "Remove a specific reason not to buy",
  OFFER_PROMOTION: "Move the audience toward a concrete commercial action",
};

export function inferStrategicDirection(context: ScriptGenerationContext): StrategicDirectionPreview {
  const funnelStage = FUNNEL_STAGE_BY_OBJECTIVE[context.request.contentObjective];
  const cognitiveObjective = COGNITIVE_OBJECTIVE_BY_OBJECTIVE[context.request.contentObjective];
  const beliefPart = context.beliefChain?.betterBeliefStatement
    ? ` — shifting them from "${context.beliefChain.currentBeliefStatement}" toward "${context.beliefChain.betterBeliefStatement}"`
    : "";
  const summary = `${cognitiveObjective} for ${context.audience.cohortName}${beliefPart}.`;
  return { funnelStage, cognitiveObjective, summary };
}

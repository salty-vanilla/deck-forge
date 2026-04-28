import { PresentationAgent } from "#/presentation-agent.js";
import type { PresentationAgentOptions } from "#/presentation-agent.js";

/**
 * AgentCore Runtime entrypoint.
 * Initialise a PresentationAgent and expose it for the runtime container.
 */
export function createAgent(options: PresentationAgentOptions): PresentationAgent {
  return new PresentationAgent(options);
}

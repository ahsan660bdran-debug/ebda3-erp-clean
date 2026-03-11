import type { PrismaClient } from "@prisma/client";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function resolveAgentForZone(
  tx: TransactionClient,
  zoneId: string
): Promise<string | null> {
  const zone = await tx.zone.findUnique({
    where:  { id: zoneId },
    select: {
      assignmentMode:    true,
      autoAssignEnabled: true,
      fixedAgentId:      true,
      agents: {
        where:   { isActive: true },
        orderBy: { rotationOrder: "asc" },
        select: {
          agentId:       true,
          rotationOrder: true,
          agent: { select: { isActive: true } },
        },
      },
    },
  });

  if (!zone)                   return null;
  if (!zone.autoAssignEnabled) return null;
  if (zone.assignmentMode === "MANUAL") return null;

  if (zone.assignmentMode === "FIXED") {
    if (!zone.fixedAgentId) return null;
    const agent = await tx.agent.findUnique({
      where:  { id: zone.fixedAgentId },
      select: { isActive: true },
    });
    return agent?.isActive ? zone.fixedAgentId : null;
  }

  // ROTATION
  type ZoneAgentEntry = { agentId: string; agent: { isActive: boolean } };
  const activeAgents = (zone.agents as ZoneAgentEntry[]).filter((za) => za.agent.isActive);
  if (activeAgents.length === 0) return null;

  const lastOrder = await tx.order.findFirst({
    where:   { zoneId },
    orderBy: { createdAt: "desc" },
    select:  { agentId: true },
  });

  if (!lastOrder?.agentId) return activeAgents[0].agentId;

  const lastIndex = activeAgents.findIndex((za) => za.agentId === lastOrder.agentId);
  const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % activeAgents.length;
  return activeAgents[nextIndex].agentId;
}

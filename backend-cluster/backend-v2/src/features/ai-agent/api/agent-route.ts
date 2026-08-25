import Router from "@koa/router";
import { type UIMessage } from "ai";
import { type AppLayers } from "@/foundation/composition";
import type { AppConfig } from "@/config/config";
import { logger } from "@/shared/logger";
import { BadUserInputError } from "@/shared/errors";
import { resolveAuthUser } from "../utils/route-guards";
import { generateOAuthToken } from "@/features/oauth/utils/oauth-token-gen";
import {
  SandboxProxyAgentHandler,
  SelfHostedAgentHandler,
  type IAgentHandler,
} from "../service/agent-handler";
import { createFallbackLanguageModel } from "@/features/llm/utils/fallback-language-model";

const agentLogger = logger.child({ module: "agent-routes" });

export async function getAgentMcpConnection(
  userId: string,
  ledgerId: string,
  config: AppConfig,
): Promise<{ mcpToken?: string; mcpUrl?: string }> {
  if (config.agent.mode !== "sandbox") return {};

  return {
    mcpToken: await generateOAuthToken(userId, ledgerId, config),
    mcpUrl: `${config.server.url}/api-gateway/mcp`,
  };
}

export function setAgentRoute(
  router: Router,
  layers: AppLayers,
  config: AppConfig,
): void {
  const handler: IAgentHandler =
    config.agent.mode === "sandbox"
      ? new SandboxProxyAgentHandler(config.agent.sandboxApiUrl)
      : new SelfHostedAgentHandler(
          createFallbackLanguageModel(config.blockeden.accessKey),
          layers.services.aiCfoUsage,
          layers.services.llm,
          layers.workflows.ledgerReceipt,
        );

  router.post("/api-gateway/agent", async (ctx) => {
    agentLogger.debug("Received agent request");

    const body = ctx.request.body as {
      messages?: unknown;
      ledgerId?: unknown;
      sessionId?: unknown;
    };
    const messages = body.messages as UIMessage[] | undefined;
    const ledgerId = body.ledgerId as string | undefined;
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : undefined;

    agentLogger.debug("Agent session", { sessionId, ledgerId });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadUserInputError("messages array cannot be empty");
    }
    if (!ledgerId || typeof ledgerId !== "string") {
      throw new BadUserInputError("ledgerId is required");
    }

    const { user, identity } = await resolveAuthUser(
      ctx,
      {
        models: layers.database.models,
        db: layers.database.db,
      },
      "write",
    );
    await layers.services.aiCfoUsage.assertQuotaAvailable(user.id);

    const mcpConnection = await getAgentMcpConnection(
      user.id,
      ledgerId,
      config,
    );

    ctx.respond = false;
    await handler.handle(
      {
        messages,
        ledgerId,
        userId: user.id,
        services: {
          ledgerShell: layers.services.ledgerShell,
          ledgerRepo: layers.services.ledgerRepo,
          apiKey: layers.services.apiKey,
        },
        identity,
        ...mcpConnection,
        sessionId,
      },
      ctx.res,
    );
  });
}

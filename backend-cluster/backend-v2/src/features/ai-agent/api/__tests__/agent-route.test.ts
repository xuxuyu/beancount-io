import type { AppConfig } from "@/config/config";
import { getAgentMcpConnection } from "../agent-route";

function configFor(mode: "self-hosted" | "sandbox"): AppConfig {
  return {
    agent: { mode, sandboxApiUrl: "https://sandbox.example/agent" },
    oauth: {
      issuer: "https://beancount.example",
      interactionUrl: "https://beancount.example",
      jwks: undefined,
      unavailableReason: "OAUTH_JWKS is required in production",
      discourseClient: {
        clientId: "discourse-forum",
        clientSecret: "",
        redirectUri: "https://beancount.example/callback",
      },
    },
    server: { url: "https://api.beancount.example" },
  } as AppConfig;
}

describe("getAgentMcpConnection", () => {
  it("does not require OAuth for the in-process self-hosted agent", async () => {
    await expect(
      getAgentMcpConnection("user-1", "alice/main", configFor("self-hosted")),
    ).resolves.toEqual({});
  });

  it("requires OAuth credentials for the external sandbox agent", async () => {
    await expect(
      getAgentMcpConnection("user-1", "alice/main", configFor("sandbox")),
    ).rejects.toThrow("OAuth is not configured on this server");
  });
});

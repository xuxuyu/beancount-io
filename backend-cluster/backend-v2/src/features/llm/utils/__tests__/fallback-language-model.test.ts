import { getOpenAIProviderSettings } from "../fallback-language-model";

describe("getOpenAIProviderSettings", () => {
  it("reads an OpenAI-compatible chat endpoint", () => {
    expect(
      getOpenAIProviderSettings({
        OPENAI_API_KEY: "temporary-key",
        OPENAI_BASE_URL: "https://gateway.example.test/v1/",
        OPENAI_MODEL: "custom-model",
        OPENAI_API_MODE: "CHAT",
      }),
    ).toEqual({
      apiKey: "temporary-key",
      baseURL: "https://gateway.example.test/v1",
      model: "custom-model",
      apiMode: "chat",
    });
  });

  it("preserves the existing OpenAI defaults", () => {
    expect(getOpenAIProviderSettings({})).toEqual({
      apiKey: undefined,
      baseURL: undefined,
      model: "gpt-4o",
      apiMode: "responses",
    });
  });

  it("rejects invalid modes and URLs", () => {
    expect(() =>
      getOpenAIProviderSettings({ OPENAI_API_MODE: "completions" }),
    ).toThrow("OPENAI_API_MODE");
    expect(() =>
      getOpenAIProviderSettings({ OPENAI_BASE_URL: "gateway.example.test" }),
    ).toThrow("OPENAI_BASE_URL");
  });
});

import { generateKeyPairSync } from 'node:crypto';
import { ProviderAuthType, ProviderType } from '../../providers/schemas/provider.schema.js';
import { GeminiAdapter } from './gemini.adapter.js';
import { clearTokenCache } from './token-cache.js';

describe('GeminiAdapter', () => {
  const adapter = new GeminiAdapter();

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  afterEach(() => {
    clearTokenCache();
    vi.unstubAllGlobals();
  });

  it('exposes gemini type', () => {
    expect(adapter.type).toBe(ProviderType.GEMINI);
  });

  describe('buildRequest', () => {
    it('translates OpenAI body to Gemini generateContent', async () => {
      const request = await adapter.buildRequest({
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'AIza-test',
        modelId: 'gemini-1.5-pro',
        body: {
          model: 'gemini-1.5-pro',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
          ],
          temperature: 0.7,
        },
        stream: false,
      });

      expect(request.url).toContain('/v1beta/models/gemini-1.5-pro:generateContent');
      expect(request.headers['x-goog-api-key']).toBe('AIza-test');

      const body = JSON.parse(request.body) as Record<string, unknown>;
      expect(body.systemInstruction).toEqual({
        parts: [{ text: 'You are helpful.' }],
      });
      expect(body.contents).toEqual([
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'model', parts: [{ text: 'hello' }] },
      ]);
      expect(body.generationConfig).toEqual({ temperature: 0.7 });
    });

    it('uses streamGenerateContent endpoint with alt=sse for stream', async () => {
      const request = await adapter.buildRequest({
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'AIza-test',
        modelId: 'gemini-1.5-pro',
        body: { messages: [{ role: 'user', content: 'hi' }] },
        stream: true,
      });

      expect(request.url).toContain(':streamGenerateContent');
      expect(request.url).toContain('alt=sse');
    });

    it('exchanges service account for bearer token in oauth mode', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({ access_token: 'ya29.token', expires_in: 3600 }),
            { status: 200 },
          ),
        ),
      );

      const request = await adapter.buildRequest({
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: JSON.stringify({
          client_email: 'svc@project.iam.gserviceaccount.com',
          private_key: privateKeyPem,
          token_uri: 'https://oauth2.googleapis.com/token',
        }),
        modelId: 'gemini-1.5-pro',
        body: { messages: [{ role: 'user', content: 'hi' }] },
        stream: false,
        authType: ProviderAuthType.OAUTH,
      });

      expect(request.headers.authorization).toBe('Bearer ya29.token');
      expect(request.headers['x-goog-api-key']).toBeUndefined();
    });

    it('reuses cached access token on subsequent requests', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ access_token: 'ya29.token', expires_in: 3600 }),
            { status: 200 },
          ),
        );
      vi.stubGlobal('fetch', fetchMock);

      const input = {
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: JSON.stringify({
          client_email: 'svc@project.iam.gserviceaccount.com',
          private_key: privateKeyPem,
          token_uri: 'https://oauth2.googleapis.com/token',
        }),
        modelId: 'gemini-1.5-pro',
        body: { messages: [{ role: 'user', content: 'hi' }] },
        stream: false,
        authType: ProviderAuthType.OAUTH,
      };

      await adapter.buildRequest(input);
      await adapter.buildRequest(input);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseResponse', () => {
    it('maps Gemini response to OpenAI chat completion', () => {
      const result = adapter.parseResponse(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello world' }],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
        'gemini-1.5-pro',
      );

      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('gemini-1.5-pro');
      expect(
        (result.choices as Array<{ message: { content: string } }>)[0].message
          .content,
      ).toBe('Hello world');
      expect(result.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });
  });

  describe('stream transformer', () => {
    it('maps Gemini SSE chunks to OpenAI chunks and extracts usage', () => {
      const transformer = adapter.createStreamTransformer();

      const events =
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}],"role":"model"}}]}\n\n' +
        'data: {"candidates":[{"content":{"parts":[{"text":" world"}],"role":"model"}}],"usageMetadata":{"promptTokenCount":6,"candidatesTokenCount":4,"totalTokenCount":10}}\n\n';

      const out = transformer.push(events) + transformer.finish();

      expect(out).toContain('"object":"chat.completion.chunk"');
      expect(out).toContain('Hello');
      expect(out).toContain('data: [DONE]');

      const usage = transformer.getUsage();
      expect(usage).toEqual({
        prompt_tokens: 6,
        completion_tokens: 4,
        total_tokens: 10,
      });
    });
  });
});

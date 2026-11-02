import { ProviderType } from '../../providers/schemas/provider.schema.js';
import { GeminiAdapter } from './gemini.adapter.js';

describe('GeminiAdapter', () => {
  const adapter = new GeminiAdapter();

  it('exposes gemini type', () => {
    expect(adapter.type).toBe(ProviderType.GEMINI);
  });

  describe('buildRequest', () => {
    it('translates OpenAI body to Gemini generateContent', () => {
      const request = adapter.buildRequest({
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

    it('uses streamGenerateContent endpoint with alt=sse for stream', () => {
      const request = adapter.buildRequest({
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'AIza-test',
        modelId: 'gemini-1.5-pro',
        body: { messages: [{ role: 'user', content: 'hi' }] },
        stream: true,
      });

      expect(request.url).toContain(':streamGenerateContent');
      expect(request.url).toContain('alt=sse');
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

import { ProviderType } from '../../providers/schemas/provider.schema.js';
import { AnthropicAdapter } from './anthropic.adapter.js';

describe('AnthropicAdapter', () => {
  const adapter = new AnthropicAdapter();

  it('exposes anthropic type', () => {
    expect(adapter.type).toBe(ProviderType.ANTHROPIC);
  });

  describe('buildRequest', () => {
    it('translates OpenAI body to Anthropic Messages', () => {
      const request = adapter.buildRequest({
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        modelId: 'claude-3-5-sonnet-20241022',
        body: {
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
          ],
          temperature: 0.7,
        },
        stream: false,
      });

      expect(request.url).toBe('https://api.anthropic.com/v1/messages');
      expect(request.headers['x-api-key']).toBe('sk-ant-test');
      expect(request.headers['anthropic-version']).toBe('2023-06-01');

      const body = JSON.parse(request.body) as Record<string, unknown>;
      expect(body.model).toBe('claude-3-5-sonnet-20241022');
      expect(body.system).toBe('You are helpful.');
      expect(body.messages).toEqual([
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
      ]);
      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0.7);
    });

    it('sets stream flag and honors max_completion_tokens', () => {
      const request = adapter.buildRequest({
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        modelId: 'claude-3-5-sonnet-20241022',
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          max_completion_tokens: 2048,
        },
        stream: true,
      });

      const body = JSON.parse(request.body) as Record<string, unknown>;
      expect(body.stream).toBe(true);
      expect(body.max_tokens).toBe(2048);
    });
  });

  describe('parseResponse', () => {
    it('maps Anthropic message to OpenAI chat completion', () => {
      const result = adapter.parseResponse(
        JSON.stringify({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hello world' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        'claude-3-5-sonnet-20241022',
      );

      expect(result.object).toBe('chat.completion');
      expect(result.choices).toHaveLength(1);
      expect(
        (result.choices as Array<{ message: { content: string } }>)[0].message
          .content,
      ).toBe('Hello world');
      expect(
        (result.choices as Array<{ finish_reason: string }>)[0].finish_reason,
      ).toBe('stop');
      expect(result.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      });
    });
  });

  describe('stream transformer', () => {
    it('maps Anthropic SSE events to OpenAI chunks and extracts usage', () => {
      const transformer = adapter.createStreamTransformer();

      const events =
        'event: message_start\n' +
        'data: {"type":"message_start","message":{"id":"msg_1","model":"claude-3-5-sonnet-20241022","usage":{"input_tokens":7}}}\n\n' +
        'event: content_block_delta\n' +
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n' +
        'event: content_block_delta\n' +
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n' +
        'event: message_delta\n' +
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}\n\n' +
        'event: message_stop\n' +
        'data: {"type":"message_stop"}\n\n';

      const out = transformer.push(events) + transformer.finish();

      expect(out).toContain('"object":"chat.completion.chunk"');
      expect(out).toContain('Hello');
      expect(out).toContain('data: [DONE]');

      const usage = transformer.getUsage();
      expect(usage).toEqual({
        prompt_tokens: 7,
        completion_tokens: 4,
        total_tokens: 11,
      });
    });
  });
});

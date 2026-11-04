import {
  anthropicError,
  anthropicToOpenAI,
  OpenAIAnthropicStreamTransformer,
  openAIToAnthropic,
} from './anthropic-protocol.js';

describe('anthropicToOpenAI', () => {
  it('maps system string and text messages', () => {
    const openai = anthropicToOpenAI({
      model: 'deepseek-v4-pro',
      max_tokens: 128,
      system: 'You are helpful.',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });

    expect(openai.model).toBe('deepseek-v4-pro');
    expect(openai.max_tokens).toBe(128);
    expect(openai.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('maps system block array and default max_tokens', () => {
    const openai = anthropicToOpenAI({
      model: 'claude-3-5-haiku',
      system: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }],
      messages: [],
    });
    expect(openai.messages).toEqual([{ role: 'system', content: 'a\nb' }]);
    expect(openai.max_tokens).toBe(4096);
  });

  it('maps assistant tool_use to tool_calls', () => {
    const openai = anthropicToOpenAI({
      model: 'x',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'thinking...' },
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'get_weather',
              input: { city: 'beijing' },
            },
          ],
        },
      ],
    });
    const assistant = (openai.messages as Array<Record<string, unknown>>)[0];
    expect(assistant.content).toBe('thinking...');
    expect(assistant.tool_calls).toEqual([
      {
        id: 'toolu_1',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: JSON.stringify({ city: 'beijing' }),
        },
      },
    ]);
  });

  it('maps user tool_result to tool message', () => {
    const openai = anthropicToOpenAI({
      model: 'x',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'toolu_1', content: 'sunny' },
          ],
        },
      ],
    });
    expect(openai.messages).toEqual([
      { role: 'tool', tool_call_id: 'toolu_1', content: 'sunny' },
    ]);
  });

  it('maps image block to image_url data url', () => {
    const openai = anthropicToOpenAI({
      model: 'x',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'AAAA',
              },
            },
          ],
        },
      ],
    });
    const user = (openai.messages as Array<Record<string, unknown>>)[0];
    expect(user.content).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,AAAA' },
      },
    ]);
  });

  it('maps tools, tool_choice and stop_sequences', () => {
    const openai = anthropicToOpenAI({
      model: 'x',
      messages: [],
      stop_sequences: ['\n'],
      tools: [
        {
          name: 'get_weather',
          description: 'desc',
          input_schema: { type: 'object', properties: {} },
        },
      ],
      tool_choice: { type: 'tool', name: 'get_weather' },
    });
    expect(openai.stop).toEqual(['\n']);
    expect(openai.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'desc',
          parameters: { type: 'object', properties: {} },
        },
      },
    ]);
    expect(openai.tool_choice).toEqual({
      type: 'function',
      function: { name: 'get_weather' },
    });
  });
});

describe('openAIToAnthropic', () => {
  it('maps text message and usage', () => {
    const result = openAIToAnthropic(
      {
        id: 'chatcmpl-1',
        model: 'deepseek-v4-pro',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'hello' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      },
      'deepseek-v4-pro',
    );

    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);
    expect(result.stop_reason).toBe('end_turn');
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 2 });
  });

  it('maps tool_calls to tool_use and length stop reason', () => {
    const result = openAIToAnthropic(
      {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"city":"beijing"}',
                  },
                },
              ],
            },
            finish_reason: 'length',
          },
        ],
      },
      'x',
    );

    expect(result.content).toEqual([
      {
        type: 'tool_use',
        id: 'call_1',
        name: 'get_weather',
        input: { city: 'beijing' },
      },
    ]);
    expect(result.stop_reason).toBe('max_tokens');
  });
});

describe('OpenAIAnthropicStreamTransformer', () => {
  it('emits Anthropic SSE events for text deltas', () => {
    const t = new OpenAIAnthropicStreamTransformer();
    let out = '';
    out += t.push(
      'data: {"id":"c1","model":"m1","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}\n\n',
    );
    out += t.push(
      'data: {"id":"c1","model":"m1","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
    );
    out += t.push(
      'data: {"id":"c1","model":"m1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
    );
    out += t.push('data: [DONE]\n\n');
    out += t.finish();

    expect(out).toContain('event: message_start');
    expect(out).toContain('event: content_block_start');
    expect(out).toContain('"text_delta"');
    expect(out).toContain('hello');
    expect(out).toContain(' world');
    expect(out).toContain('event: content_block_stop');
    expect(out).toContain('event: message_delta');
    expect(out).toContain('event: message_stop');
    expect(out).toContain('"stop_reason":"end_turn"');

    const usage = t.getUsage();
    expect(usage).toEqual({
      prompt_tokens: 5,
      completion_tokens: 2,
      total_tokens: 7,
    });
  });

  it('emits tool_use block events', () => {
    const t = new OpenAIAnthropicStreamTransformer();
    let out = '';
    out += t.push(
      'data: {"id":"c2","model":"m2","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"toolu_1","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}\n\n',
    );
    out += t.push(
      'data: {"id":"c2","model":"m2","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"city\\":"}}]},"finish_reason":null}]}\n\n',
    );
    out += t.push(
      'data: {"id":"c2","model":"m2","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
    );
    out += t.finish();

    expect(out).toContain('"type":"tool_use"');
    expect(out).toContain('"name":"get_weather"');
    expect(out).toContain('input_json_delta');
    expect(out).toContain('"stop_reason":"tool_use"');
  });
});

describe('anthropicError', () => {
  it('wraps message in Anthropic error shape', () => {
    expect(anthropicError('额度余额不足')).toEqual({
      type: 'error',
      error: { type: 'api_error', message: '额度余额不足' },
    });
  });
});

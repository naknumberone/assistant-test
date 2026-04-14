import { createOpenAI } from '@ai-sdk/openai';

export const openai = createOpenAI({
  baseURL: 'https://api.proxyapi.ru/openai/v1',
  apiKey:
    'sk-D21V3Vy0Qk83VMiJ2ZmBQFni3W0clD8l',
});

// export const openai = createOpenAI({
//   baseURL: 'https://bothub.chat/api/v2/openai/v1',
//   apiKey:
//     'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQyOWM4MDY1LTFhZjctNDg5OS1iODBjLWI4YjUzZWM0ZGE3ZiIsImlzRGV2ZWxvcGVyIjp0cnVlLCJpYXQiOjE3NjQ3NTk0MDEsImV4cCI6MjA4MDMzNTQwMX0.vnMPLvnwD3jOE3xQ2EWZFU8HucUupi4stBhXlm7pbYQ',
// });

export const model = openai('gpt-5.3-codex');

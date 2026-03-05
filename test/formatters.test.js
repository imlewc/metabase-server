import test from 'node:test';
import assert from 'node:assert/strict';

import { formatGenericResponse } from '../build/formatters.js';

test('adds question URL for card operations', () => {
  const result = formatGenericResponse('Create Card', { id: 42, name: 'Revenue' }, 'https://mb.example.com');

  assert.match(result, /\*\*URL\*\*: https:\/\/mb\.example\.com\/question\/42/);
});

test('adds dashboard URL for dashboard operations', () => {
  const result = formatGenericResponse('Update Dashboard', { id: 7, name: 'Overview' }, 'https://mb.example.com');

  assert.match(result, /\*\*URL\*\*: https:\/\/mb\.example\.com\/dashboard\/7/);
});

test('normalizes trailing slash in base URL', () => {
  const result = formatGenericResponse('Create Card', { id: 99, name: 'Users' }, 'https://mb.example.com/');

  assert.doesNotMatch(result, /\/\/question\/99/);
  assert.match(result, /\*\*URL\*\*: https:\/\/mb\.example\.com\/question\/99/);
});

test('does not add URL when id is missing', () => {
  const result = formatGenericResponse('Create Card', { name: 'No ID' }, 'https://mb.example.com');

  assert.doesNotMatch(result, /\*\*URL\*\*:/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductImageUrl, normalizeWeightLabel, parseVariantAttributes, variantChoiceLabel } from './productVariantData.js';

test('variant attributes accept JSON strings and objects, and malformed values stay empty', () => {
  assert.deepEqual(parseVariantAttributes('{"size":"M","color":"Blue"}'), { size: 'M', color: 'Blue' });
  assert.deepEqual(parseVariantAttributes({ weight: '500 g' }), { weight: '500 g' });
  assert.deepEqual(parseVariantAttributes('{invalid'), {});
  assert.deepEqual(parseVariantAttributes('[]'), {});
});

test('variant selectors use choices present in the API attributes', () => {
  assert.equal(variantChoiceLabel({ name: 'Standard', attributes: '{"size":"M","color":"Blue"}' }), 'Size: M \u00b7 Color: Blue');
  assert.equal(variantChoiceLabel({ name: '500 g', attributes: {} }), '500 g');
  assert.equal(variantChoiceLabel({ name: 'Default', attributes: {} }), '');
});

test('variant weight labels use consistent g and kg units', () => {
  assert.equal(variantChoiceLabel({ name: '250 grams', attributes: {} }), '250 g');
  assert.equal(variantChoiceLabel({ name: '500 g', attributes: {} }), '500 g');
  assert.equal(variantChoiceLabel({ name: '1 kilogram', attributes: {} }), '1 kg');
  assert.equal(variantChoiceLabel({ attributes: { weight: '250 grams', type: 'Vegetarian' } }), 'Weight: 250 g \u00b7 Type: Vegetarian');
  assert.equal(normalizeWeightLabel('500g'), '500 g');
  assert.equal(normalizeWeightLabel('1 Kilograms'), '1 kg');
});

test('image URL validation rejects known placeholders and unsafe schemes', () => {
  assert.equal(normalizeProductImageUrl('https://loremflickr.com/320/240/food'), '');
  assert.equal(normalizeProductImageUrl('javascript:alert(1)'), '');
  assert.equal(normalizeProductImageUrl('https://cdn.example.test/product.jpg'), 'https://cdn.example.test/product.jpg');
  assert.equal(normalizeProductImageUrl('uploads/product.jpg'), 'uploads/product.jpg');
});

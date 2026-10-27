export const parseVariantAttributes = (attributes) => {
  if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) return attributes;
  if (typeof attributes !== 'string') return {};
  try {
    const parsed = JSON.parse(attributes);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const normalizeWeightLabel = (value) => String(value || '').trim()
  .replace(/\b(kilograms?|kgs?)\b/ig, 'kg')
  .replace(/\b(grams?|grms?)\b/ig, 'g')
  .replace(/(\d+(?:\.\d+)?)\s*(kg|g)\b/ig, (_, amount, unit) => `${amount} ${unit.toLowerCase()}`)
  .replace(/\s+/g, ' ');

export const variantChoiceLabel = (variant) => {
  const attributes = parseVariantAttributes(variant?.attributes);
  const values = Object.entries(attributes)
    .filter(([key, value]) => /^(size|weight|color|colour|pack|type|flavou?r|capacity|material)$/i.test(key) && value !== null && value !== undefined && String(value).trim())
    .map(([key, value]) => `${key[0].toUpperCase()}${key.slice(1)}: ${/^weight$/i.test(key) ? normalizeWeightLabel(value) : String(value).trim()}`);
  if (values.length) return values.join(' · ');
  const name = String(variant?.name || variant?.label || variant?.size || variant?.weight || '').trim();
  if (/^(default|variant|option)$/i.test(name)) return '';
  return normalizeWeightLabel(name);
};

export const normalizeProductImageUrl = (value) => {
  const url = String(value || '').trim();
  if (!url || /^(?:https?:)?\/\/(?:www\.)?(?:loremflickr\.com|source\.unsplash\.com)(?:\/|$)/i.test(url)) return '';
  if (/^(?:https?:\/\/|data:image\/)/i.test(url)) return url;
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return '';
  return url;
};

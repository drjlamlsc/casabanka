const AI = (() => {
  const URL = 'https://xiaoai.plus/v1/messages';
  const MODEL = 'claude-sonnet-4-6-thinking';

  async function call(apiKey, messages, maxTokens = 4096) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();
    return data.content[0].text;
  }

  function stripBase64Prefix(b64) {
    return b64.replace(/^data:image\/\w+;base64,/, '');
  }

  function sample(arr, max) {
    if (arr.length <= max) return arr;
    const step = arr.length / max;
    return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
  }

  function extractJSON(text) {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON found in AI response');
    return JSON.parse(m[0]);
  }

  async function analyzeLayout(frames, apiKey) {
    const sampled = sample(frames, 20);
    const content = [
      ...sampled.map(f => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: stripBase64Prefix(f) },
      })),
      {
        type: 'text',
        text: `You are analyzing ${sampled.length} frames (one every 3 seconds) from a home walkthrough video.

Identify every room, storage area (wardrobes, cabinets, shelving units, drawers, cupboards), and specific storage spot (individual shelves, drawers, compartments) visible across all frames.

Return ONLY a JSON object — no markdown, no explanation:
{
  "rooms": [
    {
      "id": "r1",
      "name": "Room Name",
      "areas": [
        {
          "id": "a1",
          "name": "Area Name (e.g. Wardrobe, Kitchen Cabinet, Bookshelf)",
          "spots": [
            { "id": "s1", "name": "Spot Name (e.g. Top shelf, Left drawer, Bottom compartment)" }
          ]
        }
      ]
    }
  ]
}

Be thorough — include every room and storage location you can identify. Use natural descriptive names. Assign sequential IDs like r1, r2 for rooms; a1, a2 for areas; s1, s2 for spots globally.`,
      },
    ];
    const text = await call(apiKey, [{ role: 'user', content }], 4096);
    return extractJSON(text);
  }

  async function parseItem(photoBase64, description, layout, existingItems, apiKey) {
    // Strip photos from existing items — only need text fields for context
    const itemContext = (existingItems || []).map(i => ({
      name: i.name || '',
      purpose: i.purpose || '',
      roomId: i.roomId || null,
      roomName: i.roomName || null,
      areaId: i.areaId || null,
      areaName: i.areaName || null,
      spotId: i.spotId || null,
      spotName: i.spotName || null,
    }));

    const existingSection = itemContext.length > 0
      ? `\nExisting items already stored in this home (use these to infer location when the user references another item or says "with the X", "next to the Y", "same place as Z", "with the other tools", etc.):\n${JSON.stringify(itemContext, null, 2)}\n`
      : '';

    const content = [
      ...(photoBase64 ? [{
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: stripBase64Prefix(photoBase64) },
      }] : []),
      {
        type: 'text',
        text: `You are helping catalog a home inventory item.

User's description: "${description}"

Current home layout (use ONLY IDs and names from this):
${JSON.stringify(layout, null, 2)}
${existingSection}
Return ONLY a JSON object — no markdown, no explanation:
{
  "name": "Short descriptive item name (2–5 words)",
  "purpose": "What it is and what it's used for (1–2 sentences)",
  "roomId": "exact room id from layout or null",
  "roomName": "exact room name from layout or null",
  "areaId": "exact area id from layout or null",
  "areaName": "exact area name from layout or null",
  "spotId": "exact spot id from layout or null",
  "spotName": "exact spot name from layout or null",
  "locationConfident": true,
  "locationNote": null
}

Rules:
- Match location ONLY to IDs and names that exist in the layout above
- If the user references another item (e.g. "next to the drill", "with the tools", "same shelf as the router"), look it up in the existing items list and use that item's location
- If the user references a category (e.g. "with the other power tools"), find where similar items are stored and use the same location
- If location still cannot be determined, set locationConfident: false, unmatched fields to null, and locationNote to a brief explanation
- Extract the item name from the photo and description combined`,
      },
    ];
    const text = await call(apiKey, [{ role: 'user', content }], 1024);
    return extractJSON(text);
  }

  async function searchItems(query, items, apiKey) {
    if (!items.length || !query.trim()) return [];

    const simplified = items.map(i => ({
      id: i.id,
      name: i.name || '',
      purpose: i.purpose || '',
      notes: i.notes || '',
      location: [i.roomName, i.areaName, i.spotName].filter(Boolean).join(' › '),
    }));

    const text = await call(apiKey, [{
      role: 'user',
      content: `You are searching a home inventory. The user is looking for: "${query}"

Here are all the items:
${JSON.stringify(simplified)}

Return the IDs of items that match the search query, ordered by relevance (best match first).

Matching rules:
- Match semantically, not just exact words. "tools" should match "cordless drill", "hammer", "screwdriver".
- Match by category. "charging" matches "power bank", "phone charger", "laptop cable".
- Match by location. "garage" matches items stored in the garage even if the word isn't in the item name.
- Match by use case. "cooking" matches items stored in the kitchen or used for food prep.
- Be generous — include anything that could plausibly be what the user is looking for.

Return ONLY a JSON array of matching IDs, e.g. ["id1", "id2"]. Return [] if nothing matches. No explanation.`,
    }], 512);

    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    try { return JSON.parse(match[0]); } catch { return []; }
  }

  async function validateKey(apiKey) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    if (res.status === 401) throw new Error('Invalid API key');
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || `Error ${res.status}`);
    }
    return true;
  }

  return { analyzeLayout, parseItem, searchItems, validateKey };
})();

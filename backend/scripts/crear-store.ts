import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const dir = process.argv[2] || 'docs';
  const store = await ai.fileSearchStores.create({ config: { displayName: 'sana-docs' } });
  for (const f of fs.readdirSync(dir)) {
    let op = await ai.fileSearchStores.uploadToFileSearchStore({
      file: path.join(dir, f),
      fileSearchStoreName: store.name!,
      config: { displayName: f },
    });
    while (!op.done) {
      await new Promise((r) => setTimeout(r, 5000));
      op = await ai.operations.get({ operation: op });
    }
    console.log('Subido:', f);
  }
  console.log('\nFILE_SEARCH_STORE_NAME=' + store.name);
}
main().catch((e) => { console.error(e?.message || e); process.exit(1); });

/**
 * 存量模型元信息补齐脚本（MODEL_CARD_VIEW）
 *
 * 按 modelId 匹配官方/服务商预设，为存量模型文档补齐空缺的元信息字段：
 * description / contextLength / maxOutputLength / inputModalities / outputModalities
 *
 * 规则：
 * - 只填充空字段（空字符串、null、缺失、空数组），不覆盖已有值
 * - 预设中同样缺失的字段（如 auto 的 contextLength 为 null）跳过
 * - 未匹配到预设的模型跳过并在报告中列出
 *
 * 用法：
 *   pnpm --filter portal-backend backfill:model-metadata          # 实际写入
 *   pnpm --filter portal-backend backfill:model-metadata -- --dry # 预览，不写入
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  OFFICIAL_PRESETS,
  SERVICE_PROVIDER_PRESETS,
  type OfficialModelPreset,
} from '../src/modules/models/official-presets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry');

function loadMongoUri(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const envPath = resolve(__dirname, '../.env');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/);
    if (match) return match[1];
  }
  throw new Error(`未找到 MONGODB_URI（环境变量或 ${envPath}）`);
}

type PresetMeta = Pick<
  OfficialModelPreset,
  | 'description'
  | 'contextLength'
  | 'maxOutputLength'
  | 'inputModalities'
  | 'outputModalities'
>;

function buildPresetMap(): Map<string, PresetMeta> {
  const map = new Map<string, PresetMeta>();
  // 官方预设优先，服务商预设后写不覆盖（同 modelId 元信息一致，幂等无害）
  for (const preset of [...OFFICIAL_PRESETS, ...SERVICE_PROVIDER_PRESETS]) {
    for (const model of preset.models) {
      if (!map.has(model.modelId)) {
        map.set(model.modelId, {
          description: model.description,
          contextLength: model.contextLength,
          maxOutputLength: model.maxOutputLength,
          inputModalities: model.inputModalities,
          outputModalities: model.outputModalities,
        });
      }
    }
  }
  return map;
}

interface ModelDoc {
  _id: mongoose.Types.ObjectId;
  modelId: string;
  description?: string;
  contextLength?: number | null;
  maxOutputLength?: number | null;
  inputModalities?: string[];
  outputModalities?: string[];
}

async function main() {
  const uri = loadMongoUri();
  const presetMap = buildPresetMap();

  await mongoose.connect(uri);
  const collection = mongoose.connection.db!.collection<ModelDoc>('models');

  const docs = await collection.find({}).toArray();
  console.log(`共扫描 ${docs.length} 个模型文档${DRY_RUN ? '（dry-run，不写入）' : ''}`);

  let updated = 0;
  let skippedMatched = 0;
  const unmatched: string[] = [];

  for (const doc of docs) {
    const preset = presetMap.get(doc.modelId);
    if (!preset) {
      unmatched.push(doc.modelId);
      continue;
    }

    const $set: Record<string, unknown> = {};
    if (!doc.description && preset.description) {
      $set.description = preset.description;
    }
    if (doc.contextLength == null && preset.contextLength != null) {
      $set.contextLength = preset.contextLength;
    }
    if (doc.maxOutputLength == null && preset.maxOutputLength != null) {
      $set.maxOutputLength = preset.maxOutputLength;
    }
    if (
      (!Array.isArray(doc.inputModalities) ||
        doc.inputModalities.length === 0) &&
      preset.inputModalities.length > 0
    ) {
      $set.inputModalities = preset.inputModalities;
    }
    if (
      (!Array.isArray(doc.outputModalities) ||
        doc.outputModalities.length === 0) &&
      preset.outputModalities.length > 0
    ) {
      $set.outputModalities = preset.outputModalities;
    }

    if (Object.keys($set).length === 0) {
      skippedMatched++;
      continue;
    }

    console.log(`  [${doc.modelId}] 补齐字段: ${Object.keys($set).join(', ')}`);
    if (!DRY_RUN) {
      await collection.updateOne({ _id: doc._id }, { $set });
    }
    updated++;
  }

  console.log('---');
  console.log(`已补齐: ${updated}，已完整跳过: ${skippedMatched}，未匹配预设: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log(`未匹配列表: ${[...new Set(unmatched)].join(', ')}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

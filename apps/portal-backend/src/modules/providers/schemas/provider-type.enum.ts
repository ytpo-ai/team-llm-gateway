/**
 * ProviderType 枚举独立文件（无装饰器依赖）。
 *
 * 供脚本等非 Nest 运行时环境直接引用（如 scripts/backfill-model-metadata.ts），
 * 避免经 provider.schema.ts 拉入依赖 emitDecoratorMetadata 的 @nestjs/mongoose 装饰器。
 * provider.schema.ts 从此文件导入并再导出，保持既有引用路径兼容。
 */
export enum ProviderType {
  OPENAI_COMPATIBLE = 'openai-compatible',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
}

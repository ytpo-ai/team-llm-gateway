import {
  ArrowRight,
  AudioLines,
  Image,
  Type,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Model } from '@/features/models/types'
import { formatTokenCount } from '@/features/models/utils'

const MODALITY_ICONS: Record<string, LucideIcon> = {
  text: Type,
  image: Image,
  video: Video,
  audio: AudioLines,
}

const MODALITY_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
}

function ModalityIcons({ modalities }: { modalities: string[] }) {
  if (modalities.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <>
      {modalities.map((modality) => {
        const Icon = MODALITY_ICONS[modality] ?? Type
        const label = MODALITY_LABELS[modality] ?? modality
        return (
          <span
            key={modality}
            title={label}
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <Icon className="size-4" />
            <span className="text-xs">{label}</span>
          </span>
        )
      })}
    </>
  )
}

interface ModelCardProps {
  model: Model
  isAdmin: boolean
  onEdit: (model: Model) => void
  onDisable: (model: Model) => void
  onEnable: (model: Model) => void
  onDelete: (model: Model) => void
}

export function ModelCard({
  model,
  isAdmin,
  onEdit,
  onDisable,
  onEnable,
  onDelete,
}: ModelCardProps) {
  const bindings = [...(model.providerBindings ?? [])].sort(
    (a, b) => a.priority - b.priority,
  )
  const disabled = model.status !== 'active'

  return (
    <Card className={`flex flex-col ${disabled ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="truncate text-base">
            {model.displayName || model.modelId}
          </CardTitle>
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-xs ${
              disabled ? 'text-muted-foreground' : 'text-green-600'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                disabled ? 'bg-muted-foreground' : 'bg-green-600'
              }`}
            />
            {disabled ? '已禁用' : '正常'}
          </span>
        </div>
        <code className="truncate text-xs text-muted-foreground">
          {model.modelId}
        </code>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pb-3">
        <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
          {model.description || '暂无简介'}
        </p>

        <div className="flex items-center gap-2">
          <ModalityIcons modalities={model.inputModalities ?? []} />
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
          <ModalityIcons modalities={model.outputModalities ?? []} />
        </div>

        {bindings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bindings.map((b) => {
              const isPrimary = b.providerId === model.providerId
              return (
                <span
                  key={b.providerId}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isPrimary
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {b.providerName}
                  <span className="ml-1 opacity-60">[P{b.priority}]</span>
                </span>
              )
            })}
          </div>
        )}

        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div>
            <div className="text-base font-semibold">
              {formatTokenCount(model.contextLength)}
            </div>
            <div className="text-xs text-muted-foreground">上下文长度</div>
          </div>
          <div>
            <div className="text-base font-semibold">
              {formatTokenCount(model.maxOutputLength)}
            </div>
            <div className="text-xs text-muted-foreground">最大输出</div>
          </div>
          <div>
            <div className="text-base font-semibold">
              ×{model.multiplier}
            </div>
            <div className="text-xs text-muted-foreground">计费倍率</div>
          </div>
        </div>
      </CardContent>

      {isAdmin && (
        <CardFooter className="gap-1 pt-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(model)}>
            编辑
          </Button>
          {disabled ? (
            <Button variant="ghost" size="sm" onClick={() => onEnable(model)}>
              启用
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onDisable(model)}>
              禁用
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onDelete(model)}
          >
            删除
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

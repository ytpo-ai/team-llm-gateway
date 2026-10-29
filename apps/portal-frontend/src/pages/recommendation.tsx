import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRecommendation, listScenarios } from '@/features/recommendation/api'
import type { ModelRef, Recommendation, Scenario } from '@/features/recommendation/types'
import { cn } from '@/lib/utils'

const CAPABILITY_LABELS: Record<string, string> = {
  chat: '通用对话',
  code: '代码',
  reasoning: '推理/逻辑',
  vision: '图像/多模态',
  writing: '写作',
  translation: '翻译',
  summarization: '长文总结',
  'long-context': '长上下文',
}

function capabilityLabel(capability: string): string {
  return CAPABILITY_LABELS[capability] ?? capability
}

function CapabilityTag({ capability }: { capability: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {capabilityLabel(capability)}
    </span>
  )
}

function ModelCard({
  model,
  highlight = false,
}: {
  model: ModelRef
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-3',
        highlight && 'border-primary bg-primary/5',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <code className="truncate text-sm font-medium">{model.modelId}</code>
          {highlight && (
            <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              首选
            </span>
          )}
        </div>
        {model.displayName && (
          <div className="truncate text-xs text-muted-foreground">
            {model.displayName}
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {model.capabilities.map((capability) => (
            <CapabilityTag key={capability} capability={capability} />
          ))}
        </div>
      </div>
      <div className="ml-3 shrink-0 text-right">
        <div className="text-sm font-semibold">×{model.multiplier}</div>
        <div className="text-xs text-muted-foreground">倍率</div>
      </div>
    </div>
  )
}

function RecommendationDetail({ recommendation }: { recommendation: Recommendation }) {
  const { scenario, primary, alternatives, partialMatches } = recommendation

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{scenario.name}</h2>
        <p className="text-sm text-muted-foreground">{scenario.description}</p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">必需能力：</span>
          <span className="inline-flex flex-wrap gap-1">
            {scenario.requiredCapabilities.map((capability) => (
              <CapabilityTag key={capability} capability={capability} />
            ))}
          </span>
        </div>
        {scenario.optionalCapabilities.length > 0 && (
          <div>
            <span className="text-muted-foreground">可选能力：</span>
            <span className="inline-flex flex-wrap gap-1">
              {scenario.optionalCapabilities.map((capability) => (
                <CapabilityTag key={capability} capability={capability} />
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {scenario.cacheHint}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">推荐方案</h3>
        {primary ? (
          <div className="space-y-2">
            <ModelCard model={primary} highlight />
            {alternatives.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
            <p className="text-xs text-muted-foreground">
              首选为满足所需能力且倍率（成本）最低的模型，其余为更贵替代。
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            当前模型目录暂无满足「必需能力」的模型。请在「模型」页为模型补充相应能力标签。
          </div>
        )}
      </div>

      {partialMatches.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">部分匹配（缺少部分必需能力）</h3>
          <div className="space-y-2">
            {partialMatches.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        </div>
      )}

      {scenario.tips.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">成本优化建议</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {scenario.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {scenario.examples.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">典型任务</h3>
          <div className="flex flex-wrap gap-2">
            {scenario.examples.map((example) => (
              <span
                key={example}
                className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {example}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function RecommendationPage() {
  const scenariosQuery = useQuery({
    queryKey: ['recommendations', 'scenarios'],
    queryFn: listScenarios,
  })

  const scenarios: Scenario[] = scenariosQuery.data ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const activeScenario = scenarios.find((s) => s.id === selectedId) ?? scenarios[0] ?? null
  const activeId = activeScenario?.id ?? null

  const recommendationQuery = useQuery({
    queryKey: ['recommendations', 'scenario', activeId],
    queryFn: () => getRecommendation(activeId as string),
    enabled: activeId !== null,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">选型建议</h1>
        <p className="text-sm text-muted-foreground">
          根据模型能力与办公场景，给出更省 token 的模型选用方案
        </p>
      </div>

      {scenariosQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="text-base">办公场景</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setSelectedId(scenario.id)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                    activeId === scenario.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {scenario.name}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {recommendationQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">推荐中…</div>
              ) : recommendationQuery.data ? (
                <RecommendationDetail recommendation={recommendationQuery.data} />
              ) : (
                <div className="text-sm text-muted-foreground">
                  请选择左侧场景查看推荐方案。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

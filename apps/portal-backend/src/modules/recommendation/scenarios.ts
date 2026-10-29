export const CAPABILITY_LABELS: Record<string, string> = {
  chat: '通用对话',
  code: '代码',
  reasoning: '推理/逻辑',
  vision: '图像/多模态',
  writing: '写作',
  translation: '翻译',
  summarization: '长文总结',
  'long-context': '长上下文',
};

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  cacheHint: string;
  tips: string[];
  examples: string[];
}

export const SCENARIOS: ScenarioTemplate[] = [
  {
    id: 'chat',
    name: '日常对话',
    description: '通用问答、头脑风暴、日常办公助手',
    requiredCapabilities: ['chat'],
    optionalCapabilities: ['reasoning'],
    cacheHint: '建议开启缓存：常见问题命中率高，可显著降低 token 成本。',
    tips: ['优先选用倍率较低的通用对话模型', '复杂追问可临时切换到高能力模型'],
    examples: ['写一封邮件', '解释某个概念', '头脑风暴标题'],
  },
  {
    id: 'code',
    name: '代码生成',
    description: '代码编写、补全、函数实现',
    requiredCapabilities: ['code'],
    optionalCapabilities: ['chat'],
    cacheHint: '建议开启缓存：重复代码片段与样板代码命中率高。',
    tips: ['样板代码可用倍率更低的模型', '核心算法实现用高能力代码模型'],
    examples: ['实现一个排序函数', '补全一个 REST 接口'],
  },
  {
    id: 'code-review',
    name: '代码审查',
    description: '代码走查、缺陷定位、安全审查',
    requiredCapabilities: ['code', 'reasoning'],
    optionalCapabilities: [],
    cacheHint: '审查场景缓存收益有限，可不开启。',
    tips: ['审查需要推理能力，选择具备 code + reasoning 标签的模型', '关注倍率，避免审查成本过高'],
    examples: ['审查一段 PR 改动', '定位潜在空指针问题'],
  },
  {
    id: 'writing',
    name: '文档撰写',
    description: '报告、方案、周报、公文撰写',
    requiredCapabilities: ['writing'],
    optionalCapabilities: ['chat', 'long-context'],
    cacheHint: '可开启缓存：模板化文档（周报/月报）命中率高。',
    tips: ['长文档优先选择具备长上下文能力的模型', '初稿可用便宜模型，精修再换高能力模型'],
    examples: ['生成一份项目周报', '润色一份方案文档'],
  },
  {
    id: 'translation',
    name: '翻译',
    description: '中英互译、多语种翻译、术语对照',
    requiredCapabilities: ['translation'],
    optionalCapabilities: ['chat'],
    cacheHint: '建议开启缓存：相同段落反复翻译命中率高。',
    tips: ['通用翻译选用倍率较低模型即可', '专业术语场景建议补充术语表'],
    examples: ['翻译一份产品说明', '邮件中英互译'],
  },
  {
    id: 'summarization',
    name: '长文总结',
    description: '长文档摘要、会议纪要、要点提炼',
    requiredCapabilities: ['summarization'],
    optionalCapabilities: ['long-context', 'reasoning'],
    cacheHint: '建议开启缓存：同一文档多次总结命中率高。',
    tips: ['超长文档优先选择具备长上下文能力的模型', '摘要任务可用便宜模型，不必用推理模型'],
    examples: ['总结一篇论文', '提炼会议纪要要点'],
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    description: '数据推理、逻辑分析、数学计算',
    requiredCapabilities: ['reasoning'],
    optionalCapabilities: ['code', 'long-context'],
    cacheHint: '分析场景缓存收益有限，可不开启。',
    tips: ['复杂推理选择具备 reasoning 标签的模型', '简单统计可用倍率较低模型'],
    examples: ['分析一组销售数据', '推导一个业务结论'],
  },
  {
    id: 'vision',
    name: '图像理解',
    description: '图片识别、OCR、图文理解',
    requiredCapabilities: ['vision'],
    optionalCapabilities: ['chat'],
    cacheHint: '图像理解缓存收益有限，可不开启。',
    tips: ['务必选择具备 vision 标签的多模态模型', '纯文本场景避免使用多模态模型以省成本'],
    examples: ['识别一张截图内容', '提取图片中的表格'],
  },
];

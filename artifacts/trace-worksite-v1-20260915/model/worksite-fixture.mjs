// Explicit, isolated visual fixture. These are not observations about the real project.
export function savedFixture() {
  const matters = [
    { id: 'demo-worksite-recall', title: '收藏后为什么接不回来', stop: '恢复当时的触动，是否需要自己的附言？', understanding: '也许需要补一句自己的感受。', version: 1 },
    { id: 'demo-worksite-light-capture', title: '允许只留下一点，不强制整理', stop: '保存时，哪些内容可以以后再补？', understanding: '可以先保存，不必马上补完标题、分类和理由。', version: 1 },
  ];
  const intake = [
    {
      id: 'demo-intake-light-capture', matterId: 'demo-worksite-light-capture',
      title: '允许只留下一点，不强制整理', sourceText: matters[1].understanding, sourceVersion: 1,
      source: { title: '我的理解 · 示例', excerpt: matters[1].understanding, url: null },
      relevance: '这次正在设计保存入口，它会影响哪些内容必须填写。',
      usePlan: '先完成保存，再允许补一句自己的感受。', role: 'reference', note: '',
    },
    {
      id: 'demo-intake-recall', matterId: 'demo-worksite-recall',
      title: '保存材料，不等于恢复当时的触动', sourceText: matters[0].understanding, sourceVersion: 1,
      source: { title: '收藏后为什么接不回来 · 示例', excerpt: '个人表达，还是原文现场？', url: null },
      relevance: '用于回看体验的判断：只留材料，之后能否接回当时的想法。',
      usePlan: '观察几天后能否接回当时为什么在意。', role: 'trial', note: '',
    },
  ];
  const evidence = [
    { id: 'demo-evidence-provided', stage: 'provided', text: '示例上下文记录中包含这两条带入。', source: { title: '本次带入记录 · 示例', excerpt: '两条理解作为本次任务的参考与尝试。', url: null }, isDemo: true },
    { id: 'demo-evidence-decision', stage: 'decision', text: '示例取舍：附言作为可选项，不阻挡保存。', source: { title: '保存入口取舍 · 示例', excerpt: '先完成保存，再允许补一句自己的感受。', url: null }, isDemo: true },
    { id: 'demo-evidence-artifact', stage: 'artifact', text: '示例检查：未填写附言，也可以完成保存。', source: { title: '保存流程检查记录 · 示例', excerpt: '附言可选；保存操作不依赖附言。', url: null }, isDemo: true },
  ];
  return {
    matters,
    works: [
      {
        id: 'demo-worksite-save', title: '实现「从知乎留下一点」', agent: 'Codex', project: 'harness',
        scope: 'current-task', connected: false, intake,
        decision: { id: 'demo-decision-optional-note', title: '附言作为可选项，不阻挡保存', description: '先完成保存，再允许补一句自己的感受。', artifact: { title: '保存交互原型 · 示例', url: null, isDemo: true }, intakeIds: intake.map(item => item.id) },
        impact: { relation: 'proposed', stages: { provided: true, decision: true, artifact: true, usage: false }, confirmed: ['未填写附言，也可以完成保存。'], unconfirmed: ['几天后，是否能恢复当时为什么在意。'], evidence, correction: '' },
      },
      {
        id: 'demo-worksite-return', title: '观察几天后的回看体验', agent: 'Codex', project: 'harness',
        scope: 'current-task', connected: false,
        intake: [{ ...intake[1], id: 'demo-intake-recall-later', role: 'contrast' }],
      },
    ],
  };
}

export const DEMO_FINDING = '保存很轻，但回来时可能认不出当时为什么在意。';
export const DEMO_RESULT = {
  matterId: 'demo-worksite-recall',
  fact: '这一次没有写附言，但借助原文和前后讨论，想起了当时为什么在意。',
  interpretation: '这次可能是原文和前后讨论保留了足够的现场信息。',
  unconfirmed: '哪些情况下，只有自己的一句话才能补上缺失？',
  proposedUnderstanding: '附言不一定每次都需要。先保留足以恢复现场的信息，再允许补充个人感受。',
  relation: 'unknown',
};

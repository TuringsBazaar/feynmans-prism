export interface Assignment {
  agent: 'aman' | 'gwern'
  task: string
}
export interface Plan {
  tasks: Assignment[]
  represent: boolean
}

export const planningPrompt = `Create a bounded research plan. Return only JSON with this shape:
{"tasks":[{"agent":"aman","task":"..."},{"agent":"gwern","task":"..."}],"represent":false}
Assign exactly one task to Aman and one to Gwern. Each task must specify its
expected output and a concrete question. Set represent true only when a graph
or structured research tree would help. Do not answer the research question.`

export function parsePlan(text: string): Plan {
  const plan = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
  if (!plan || !Array.isArray(plan.tasks) || plan.tasks.length !== 2 || typeof plan.represent !== 'boolean')
    throw new Error('Chair returned an invalid plan; ask again or address a worker directly')
  const ids = new Set<string>()
  for (const task of plan.tasks) {
    if (
      !task ||
      !['aman', 'gwern'].includes(task.agent) ||
      typeof task.task !== 'string' ||
      !task.task.trim() ||
      task.task.length > 4000 ||
      ids.has(task.agent)
    )
      throw new Error('Chair returned an invalid assignment')
    ids.add(task.agent)
  }
  return plan
}

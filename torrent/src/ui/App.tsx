// Root Ink component: header + problem list in a box, then the feed and composer.

import { Box, Text, useApp, useInput } from 'ink'
import { PROBLEMS } from '../data.ts'
import { useStore } from '../state.ts'
import { handleKey } from './keys.ts'
import { Composer, Feed, Header, ProblemRow } from './widgets.tsx'

export function App() {
  const data = useStore((s) => s.data)
  const { exit } = useApp()
  useInput((input, key) => handleKey(input, key, exit))

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="single" paddingX={1}>
        <Header data={data} />
        <Box flexDirection="column" marginTop={1}>
          <Text bold>PROBLEMS</Text>
          {PROBLEMS.map((p, i) => (
            <ProblemRow key={p.id} problem={p} index={i} data={data} />
          ))}
        </Box>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Feed data={data} />
      </Box>
      <Box marginTop={1}>
        <Composer data={data} />
      </Box>
    </Box>
  )
}

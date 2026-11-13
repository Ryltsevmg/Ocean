/** Display-only command references; command execution stays with the original command input. */
import type { UserTextNodeProps } from '@ocean/ocean-client-ui-conversation/client'
import { ReferenceChip } from '@ocean/ocean-client-ui-primitives'

/**
 * Render one confirmed command token without adding an activation action.
 * @param props - resolved command node and its original spelling.
 * @returns a noninteractive inline command chip.
 */
export function GoalCommandReference({ node, raw }: UserTextNodeProps<'command'>) {
  return <ReferenceChip appearance="command" label={`/${node.data.name}`} title={raw} />
}

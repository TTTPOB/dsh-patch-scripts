const edits = [
  [
    'Before you finish, send your result to that agent with ',
    'When you are about to finish your current turn and settle, do not call ',
  ],
  [
    ' }). The parent shares ',
    ' }) merely to report the same result to your parent. Put the result in your final assistant response instead; settlement will automatically notify the parent with that final message. The parent shares ',
  ],
  [
    'your workspace but does not automatically receive your transcript, tool output, or reasoning. Send ',
    'your workspace but does not automatically receive your transcript, tool output, or reasoning. Use ',
  ],
  [
    'earlier messages as well when a finding changes what the parent should do next; sending a message ',
    'send_message only when information genuinely needs to reach the parent before you settle, especially when a finding changes what the parent should do next. If you start background work, do not end the turn ',
  ],
  [
    'does not end your turn.',
    'until your final report is complete; settling earlier may deliver an incomplete report.',
  ],
].map(([before, after]) => ({ before, after }))

export default {
  id: 'subagent-settlement',
  description: 'Tell settling subagents to report through their final response',
  targets: [{
    packageName: '@deepseek-ai/dsh-subagent',
    files: [
      { path: 'lib/index.js', edits },
      { path: 'lib/types/continuation-messages.js', edits },
    ],
  }],
}

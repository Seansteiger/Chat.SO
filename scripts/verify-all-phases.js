import assert from 'node:assert';
import {
  UserStatusEnum,
  RegisterSchema,
  LoginSchema,
  SendMessageSchema,
  MessageDtoSchema,
  MAX_FILE_SIZE_BYTES,
  QUIET_EMOJIS,
  QuietEmojiEnum,
  CreateCircleSchema,
  CreatePollSchema,
  CastVoteSchema,
} from '@chatso/shared';

console.log('========================================================');
console.log('  STARTING DEEP VERIFICATION: PHASES 1 - 4 SUITE');
console.log('========================================================\n');

let passedCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

// -------------------------------------------------------------
// PHASE 1: Core Messaging Depth & Multi-Device Reliability
// -------------------------------------------------------------
console.log('--- Phase 1: Core Messaging Depth & Multi-Device Reliability ---');

test('P1.1: SendMessageSchema accepts replyToId for in-chat quotes', () => {
  const payload = {
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    recipientId: '123e4567-e89b-12d3-a456-426614174001',
    content: 'This is a thoughtful reply.',
    replyToId: '123e4567-e89b-12d3-a456-426614174002',
  };
  const res = SendMessageSchema.safeParse(payload);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.replyToId, payload.replyToId);
});

test('P1.2: MessageDtoSchema handles replies, edit status, deleted placeholders, and reactions', () => {
  const messageData = {
    id: 'msg-101',
    conversationId: 'conv-202',
    senderId: 'user-303',
    clientMessageId: 'c-msg-1',
    content: 'Original message content',
    status: 'READ',
    createdAt: new Date().toISOString(),
    replyToId: 'msg-100',
    replySnippet: {
      id: 'msg-100',
      senderName: 'Introvert Alice',
      content: 'A quiet quote from Alice',
    },
    isEdited: true,
    editedAt: Date.now(),
    isDeleted: false,
    reactions: [
      { emoji: '👍', count: 2, users: ['user-1', 'user-2'], hasReacted: true },
      { emoji: '💡', count: 1, users: ['user-3'], hasReacted: false },
    ],
  };
  const res = MessageDtoSchema.safeParse(messageData);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.isEdited, true);
  assert.strictEqual(res.data.reactions?.length, 2);
  assert.strictEqual(res.data.replySnippet?.senderName, 'Introvert Alice');
});

test('P1.3: Soft deletion flags are preserved in schema', () => {
  const deletedMessage = {
    id: 'msg-102',
    conversationId: 'conv-202',
    senderId: 'user-303',
    clientMessageId: 'c-msg-2',
    content: 'This message was deleted',
    status: 'READ',
    createdAt: new Date().toISOString(),
    isDeleted: true,
    deletedAt: Date.now(),
  };
  const res = MessageDtoSchema.safeParse(deletedMessage);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.isDeleted, true);
});

test('P1.4: QuietEmojiEnum only allows the 5 peaceful emojis', () => {
  for (const emoji of QUIET_EMOJIS) {
    const res = QuietEmojiEnum.safeParse(emoji);
    assert.strictEqual(res.success, true, `Quiet emoji ${emoji} must be allowed`);
  }
  // Loud or intrusive emojis should be rejected
  assert.strictEqual(QuietEmojiEnum.safeParse('🎉').success, false);
  assert.strictEqual(QuietEmojiEnum.safeParse('🔥').success, false);
  assert.strictEqual(QuietEmojiEnum.safeParse('💩').success, false);
});

// -------------------------------------------------------------
// PHASE 2: Introvert Boundaries & Personal Vault
// -------------------------------------------------------------
console.log('\n--- Phase 2: Introvert Boundaries & Personal Vault ---');

test('P2.1: UserStatusEnum supports LOW_BATTERY and DEEP_FOCUS modes', () => {
  const allStatuses = UserStatusEnum.options;
  assert.ok(allStatuses.includes('ONLINE'), 'Must include ONLINE');
  assert.ok(allStatuses.includes('LOW_BATTERY'), 'Must include LOW_BATTERY');
  assert.ok(allStatuses.includes('DEEP_FOCUS'), 'Must include DEEP_FOCUS');
  assert.ok(allStatuses.includes('BUSY'), 'Must include BUSY');
  assert.ok(allStatuses.includes('OFFLINE'), 'Must include OFFLINE');
});

test('P2.2: SendMessageSchema supports silent delivery flag', () => {
  const silentMsg = {
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    content: 'Gentle async update for tomorrow morning.',
    isSilent: true,
  };
  const res = SendMessageSchema.safeParse(silentMsg);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.isSilent, true);
});

test('P2.3: MessageDtoSchema handles Personal Vault & Pinned flags', () => {
  const vaultMessage = {
    id: 'vault-1',
    conversationId: 'self-vault-conv',
    senderId: 'my-user-id',
    clientMessageId: 'self-msg-1',
    content: 'Secret ideas: Remember to rest after social interactions.',
    status: 'SENT',
    createdAt: new Date().toISOString(),
    isPinned: true,
    pinnedAt: Date.now(),
  };
  const res = MessageDtoSchema.safeParse(vaultMessage);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.isPinned, true);
});

// -------------------------------------------------------------
// PHASE 3: Context Drawer & Voice/Note Tools
// -------------------------------------------------------------
console.log('\n--- Phase 3: Context Drawer & Voice/Note Tools ---');

test('P3.1: Voice note metadata (voiceDuration) is validated', () => {
  const voiceMsg = {
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    content: '🎤 Voice note',
    attachmentUrl: 'https://storage.chat.so/audio/note123.webm',
    attachmentName: 'voice_note.webm',
    attachmentMime: 'audio/webm',
    voiceDuration: 42, // 42 seconds
  };
  const res = SendMessageSchema.safeParse(voiceMsg);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.voiceDuration, 42);
});

test('P3.2: 50MB direct attachment limit is strictly enforced', () => {
  assert.strictEqual(MAX_FILE_SIZE_BYTES, 50 * 1024 * 1024);
  const oversized = {
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    content: 'Oversized doc',
    attachmentSize: 50 * 1024 * 1024 + 1,
  };
  const res = SendMessageSchema.safeParse(oversized);
  assert.strictEqual(res.success, false);
});

// -------------------------------------------------------------
// PHASE 4: Intimate Circles (Small Groups) & Group Polls
// -------------------------------------------------------------
console.log('\n--- Phase 4: Intimate Circles & Group Decision Polls ---');

test('P4.1: SendMessageSchema supports decision poll attachment (pollId)', () => {
  const pollMsg = {
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    content: '📊 Poll: Which quiet coffee shop shall we visit this Saturday?',
    pollId: 'poll-xyz-987',
  };
  const res = SendMessageSchema.safeParse(pollMsg);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.pollId, 'poll-xyz-987');
});

test('P4.2: CreateCircleSchema strictly enforces 2-25 member limit', () => {
  assert.strictEqual(CreateCircleSchema.safeParse({ name: 'Book Club', maxMembers: 8 }).success, true);
  assert.strictEqual(CreateCircleSchema.safeParse({ name: 'Book Club', maxMembers: 25 }).success, true);
  assert.strictEqual(CreateCircleSchema.safeParse({ name: 'Book Club', maxMembers: 2 }).success, true);
  assert.strictEqual(CreateCircleSchema.safeParse({ name: 'Book Club', maxMembers: 26 }).success, false);
  assert.strictEqual(CreateCircleSchema.safeParse({ name: 'Book Club', maxMembers: 1 }).success, false);
  assert.strictEqual(CreateCircleSchema.safeParse({ name: '   ', maxMembers: 5 }).success, false);
});

test('P4.3: CastVoteSchema validates vote inputs', () => {
  assert.strictEqual(CastVoteSchema.safeParse({ pollId: 'poll-123', optionIndex: 0 }).success, true);
  assert.strictEqual(CastVoteSchema.safeParse({ pollId: 'poll-123', optionIndex: 2 }).success, true);
  assert.strictEqual(CastVoteSchema.safeParse({ pollId: 'poll-123', optionIndex: -1 }).success, false);
  assert.strictEqual(CastVoteSchema.safeParse({ pollId: '', optionIndex: 0 }).success, false);
});

// -------------------------------------------------------------
// EDGE CASES & BOUNDARY CONDITIONS
// -------------------------------------------------------------
console.log('\n--- Edge Cases & Boundary Conditions ---');

test('E1: Empty or whitespace-only messages without attachment are rejected', () => {
  const whitespaceOnly = {
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    content: '   \n\t  ',
  };
  const res = SendMessageSchema.safeParse(whitespaceOnly);
  assert.strictEqual(res.success, false, 'Whitespace-only messages must be rejected');
});

test('E2: 5000 character maximum limit is strictly respected', () => {
  const maxContent = 'a'.repeat(5000);
  const validMax = SendMessageSchema.safeParse({
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    content: maxContent,
  });
  assert.strictEqual(validMax.success, true, '5000 chars must be allowed');

  const overflowContent = 'a'.repeat(5001);
  const invalidOverflow = SendMessageSchema.safeParse({
    clientMessageId: '123e4567-e89b-12d3-a456-426614174000',
    content: overflowContent,
  });
  assert.strictEqual(invalidOverflow.success, false, '5001 chars must be rejected');
});

test('E3: Invalid UUID clientMessageId is rejected', () => {
  const badUuid = {
    clientMessageId: 'invalid-uuid-format',
    content: 'Hello world',
  };
  const res = SendMessageSchema.safeParse(badUuid);
  assert.strictEqual(res.success, false, 'Malformed UUID must be rejected');
});

test('E4: CreatePollSchema rejects empty questions or invalid option lists', () => {
  assert.strictEqual(CreatePollSchema.safeParse({ question: 'Where to eat?', options: [] }).success, false);
  assert.strictEqual(CreatePollSchema.safeParse({ question: 'Where to eat?', options: ['Single Option'] }).success, false);
  assert.strictEqual(CreatePollSchema.safeParse({ question: 'Where to eat?', options: ['Opt 1', '   '] }).success, false);
  assert.strictEqual(CreatePollSchema.safeParse({ question: '   ', options: ['Option A', 'Option B'] }).success, false);
  assert.strictEqual(CreatePollSchema.safeParse({ question: 'Where to eat?', options: ['Option A', 'Option B'] }).success, true);
});

console.log('\n========================================================');
console.log(`  VERIFICATION RESULTS: ${passedCount} / ${totalCount} PASSED`);
console.log('========================================================');

if (passedCount !== totalCount) {
  process.exit(1);
}

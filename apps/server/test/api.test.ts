import {
  RegisterSchema,
  LoginSchema,
  SignUploadUrlSchema,
  SendMessageSchema,
  MAX_FILE_SIZE_BYTES,
} from '@chatso/shared';
import { StorageService } from '../src/services/storage.service.js';
import { WebRtcService } from '../src/services/webrtc.service.js';

async function runTests() {
  console.log('--- RUNNING SERVER & SCHEMA TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✔ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✖ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Test 50MB File Size Strict Limit
  try {
    const validFile = SignUploadUrlSchema.safeParse({
      fileName: 'presentation.pdf',
      mimeType: 'application/pdf',
      fileSize: 50 * 1024 * 1024, // 50MB exactly
    });
    assert(validFile.success, 'SignUploadUrlSchema accepts exactly 50MB file');

    const oversizedFile = SignUploadUrlSchema.safeParse({
      fileName: 'large_video.mp4',
      mimeType: 'video/mp4',
      fileSize: MAX_FILE_SIZE_BYTES + 1, // 50MB + 1 byte
    });
    assert(!oversizedFile.success, 'SignUploadUrlSchema rejects file > 50MB (52,428,800 bytes)');
  } catch (err) {
    assert(false, `File schema test exception: ${err}`);
  }

  // 2. Test StorageService generator
  try {
    const signedUrlData = await StorageService.generateSignedUploadUrl({
      userId: 'test-user-uuid',
      fileName: 'avatar.png',
      mimeType: 'image/png',
      fileSize: 1024 * 1024,
      baseUrl: 'http://localhost:3001',
    });
    assert(signedUrlData.uploadUrl.length > 0, 'StorageService generates uploadUrl');
    assert(signedUrlData.publicUrl.length > 0, 'StorageService generates publicUrl');
    assert(signedUrlData.expiresInSeconds === 900, 'StorageService expires in 15 minutes (900s)');
  } catch (err) {
    assert(false, `StorageService test exception: ${err}`);
  }

  // 3. Test WebRtcService ICE Servers
  try {
    const ice = WebRtcService.getIceServers('user-123');
    assert(ice.iceServers.length > 0, 'WebRtcService returns ICE servers array');
    const hasStun = ice.iceServers.some((s) =>
      Array.isArray(s.urls) ? s.urls.some((u) => u.includes('stun:')) : s.urls.includes('stun:')
    );
    assert(hasStun, 'WebRtcService contains STUN servers');
  } catch (err) {
    assert(false, `WebRtcService test exception: ${err}`);
  }

  // 4. Test Auth & Message Schemas
  try {
    const validReg = RegisterSchema.safeParse({
      username: 'alice123',
      email: 'alice@example.com',
      password: 'password123',
      displayName: 'Alice Wonderland',
    });
    assert(validReg.success, 'RegisterSchema accepts valid registration payload');

    const invalidMsg = SendMessageSchema.safeParse({
      clientMessageId: 'not-a-uuid',
      recipientId: '123',
      content: '',
    });
    assert(!invalidMsg.success, 'SendMessageSchema rejects invalid UUID and empty content');
  } catch (err) {
    assert(false, `Auth/Message schema test exception: ${err}`);
  }

  console.log(`\nTEST RESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

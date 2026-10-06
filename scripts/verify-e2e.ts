import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '@chatso/shared';

const API_BASE = 'http://localhost:3001/api';
const SERVER_URL = 'http://localhost:3001';
const CLIENT_URL = 'http://localhost:5173';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verify() {
  console.log('====================================================');
  console.log('   CHAT.SO END-TO-END AUTOMATED VERIFICATION');
  console.log('====================================================\n');

  let passedSteps = 0;
  function report(name: string, ok: boolean, detail: string = '') {
    if (ok) {
      console.log(`[PASS] ${name} ${detail ? '(' + detail + ')' : ''}`);
      passedSteps++;
    } else {
      console.error(`[FAIL] ${name} ${detail ? ': ' + detail : ''}`);
      process.exit(1);
    }
  }

  // 1. Check Server Health
  try {
    const res = await fetch(`${SERVER_URL}/health`);
    const data = await res.json();
    report('1. Server Healthcheck', res.ok && data.status === 'ok', `status: ${data.status}`);
  } catch (err: any) {
    report('1. Server Healthcheck', false, err.message);
  }

  // 2. Check PWA Assets on Frontend
  try {
    const manifestRes = await fetch(`${CLIENT_URL}/manifest.webmanifest`);
    const manifest = await manifestRes.json();
    report(
      '2. PWA Manifest Service',
      manifestRes.ok && manifest.name === 'Chat.SO — Real-Time Communication',
      `app: ${manifest.name}, display: ${manifest.display}`
    );

    const swRes = await fetch(`${CLIENT_URL}/sw.js`);
    report('3. PWA Service Worker Service', swRes.ok && swRes.status === 200, `status: ${swRes.status}`);
  } catch (err: any) {
    report('2/3. PWA Verification', false, err.message);
  }

  // 4. Register / Login User A (Alice)
  let aliceToken = '';
  let aliceUser: any = null;
  try {
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice_test',
        email: 'alice_test@example.com',
        password: 'password123',
        displayName: 'Alice Tester',
      }),
    });

    if (regRes.status === 409) {
      // Already registered, log in
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'alice_test', password: 'password123' }),
      });
      const data = await loginRes.json();
      aliceToken = data.token;
      aliceUser = data.user;
    } else {
      const data = await regRes.json();
      aliceToken = data.token;
      aliceUser = data.user;
    }
    report('4. Alice Authentication', !!aliceToken && !!aliceUser?.id, `User ID: ${aliceUser?.id}`);
  } catch (err: any) {
    report('4. Alice Authentication', false, err.message);
  }

  // 5. Register / Login User B (Bob)
  let bobToken = '';
  let bobUser: any = null;
  try {
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'bob_test',
        email: 'bob_test@example.com',
        password: 'password123',
        displayName: 'Bob Tester',
      }),
    });

    if (regRes.status === 409) {
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'bob_test', password: 'password123' }),
      });
      const data = await loginRes.json();
      bobToken = data.token;
      bobUser = data.user;
    } else {
      const data = await regRes.json();
      bobToken = data.token;
      bobUser = data.user;
    }
    report('5. Bob Authentication', !!bobToken && !!bobUser?.id, `User ID: ${bobUser?.id}`);
  } catch (err: any) {
    report('5. Bob Authentication', false, err.message);
  }

  // 6. Test File Signing 50MB Enforcement
  try {
    // Under 50MB
    const validSignRes = await fetch(`${API_BASE}/files/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        fileName: 'dataset.zip',
        mimeType: 'application/zip',
        fileSize: 45 * 1024 * 1024, // 45MB
      }),
    });
    const validSignData = await validSignRes.json();
    report(
      '6. Direct File Signing (<50MB)',
      validSignRes.ok && !!validSignData.uploadUrl,
      `uploadUrl: ${validSignData.uploadUrl.substring(0, 40)}...`
    );

    // Over 50MB (52,428,801 bytes)
    const overSignRes = await fetch(`${API_BASE}/files/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        fileName: 'huge_archive.zip',
        mimeType: 'application/zip',
        fileSize: 52_428_801,
      }),
    });
    report(
      '7. Direct File Signing (>50MB Hard Limit Rejection)',
      overSignRes.status === 400,
      `Status: ${overSignRes.status} (Rejected as expected)`
    );

    // Test direct PUT upload simulation
    const testContent = Buffer.from('Antigravity 2.0 WebRTC Direct Upload Test Payload');
    const uploadRes = await fetch(validSignData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: testContent,
    });
    report(
      '8. Direct PUT Upload Execution',
      uploadRes.ok,
      `HTTP status: ${uploadRes.status}`
    );
  } catch (err: any) {
    report('6/7/8. File Signing and Upload', false, err.message);
  }

  // 9. ICE Servers & STUN endpoint verification
  try {
    const iceRes = await fetch(`${API_BASE}/webrtc/ice-servers`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const iceData = await iceRes.json();
    report(
      '9. WebRTC ICE Servers Endpoint',
      iceRes.ok && iceData.iceServers.length > 0,
      `Returned ${iceData.iceServers.length} ICE server groups`
    );
  } catch (err: any) {
    report('9. WebRTC ICE Servers', false, err.message);
  }

  // 10. Real-time Sockets & Presence
  console.log('\n--- Connecting Sockets for Alice and Bob ---');
  const aliceSocket = io(SERVER_URL, {
    auth: { token: aliceToken },
    transports: ['websocket'],
  });
  const bobSocket = io(SERVER_URL, {
    auth: { token: bobToken },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    aliceSocket.on('connect', check);
    bobSocket.on('connect', check);
  });
  report('10. Dual Socket.IO Authentication Handshake', true, 'Alice & Bob connected simultaneously');

  // 11. Test Real-time 1-on-1 Text Message Dispatch
  const testMessagePromise = new Promise<any>((resolve) => {
    bobSocket.on(SOCKET_EVENTS.CHAT_RECEIVE, (msg: any) => {
      resolve(msg);
    });
  });

  const clientMsgId = crypto.randomUUID();
  aliceSocket.emit(
    SOCKET_EVENTS.CHAT_SEND,
    {
      clientMessageId: clientMsgId,
      recipientId: bobUser.id,
      content: 'Hello Bob! This is Alice from Chat.SO!',
    },
    (ack: any) => {
      console.log('Alice chat:send ACK:', ack);
    }
  );

  const receivedMsg = await Promise.race([
    testMessagePromise,
    sleep(4000).then(() => null),
  ]);

  report(
    '11. Real-Time 1-on-1 Chat Dispatch',
    !!receivedMsg && receivedMsg.clientMessageId === clientMsgId,
    `Message: "${receivedMsg?.content}"`
  );

  // 12. Test Typing Indicator
  const typingPromise = new Promise<any>((resolve) => {
    bobSocket.on(SOCKET_EVENTS.CHAT_TYPING, (data: any) => {
      resolve(data);
    });
  });

  aliceSocket.emit(SOCKET_EVENTS.CHAT_TYPING, {
    recipientId: bobUser.id,
    isTyping: true,
  });

  const typingData = await Promise.race([
    typingPromise,
    sleep(3000).then(() => null),
  ]);

  report(
    '12. Live Typing Indicator Relay',
    !!typingData && typingData.isTyping === true && typingData.senderId === aliceUser.id,
    `Alice typing flag broadcasted to Bob`
  );

  // 13. Test WebRTC Call Negotiation Lifecycle
  console.log('\n--- Testing WebRTC 1-on-1 Call Signaling Machine ---');
  const incomingCallPromise = new Promise<any>((resolve) => {
    bobSocket.on(SOCKET_EVENTS.CALL_INCOMING, (payload: any) => {
      resolve(payload);
    });
  });

  aliceSocket.emit(SOCKET_EVENTS.CALL_INITIATE, {
    recipientId: bobUser.id,
    isVideo: true,
  });

  const incomingPayload = await Promise.race([
    incomingCallPromise,
    sleep(4000).then(() => null),
  ]);

  report(
    '13. WebRTC Call Initiation (call:initiate -> call:incoming)',
    !!incomingPayload && incomingPayload.callerId === aliceUser.id,
    `Caller: ${incomingPayload?.callerName}, Video: ${incomingPayload?.isVideo}`
  );

  // Bob accepts call
  const callAcceptedPromise = new Promise<any>((resolve) => {
    aliceSocket.on(SOCKET_EVENTS.CALL_ACCEPT, (payload: any) => {
      resolve(payload);
    });
  });

  bobSocket.emit(SOCKET_EVENTS.CALL_ACCEPT, { callerId: aliceUser.id });
  const acceptPayload = await Promise.race([
    callAcceptedPromise,
    sleep(3000).then(() => null),
  ]);

  report(
    '14. WebRTC Call Acceptance (call:accept)',
    !!acceptPayload && acceptPayload.peerId === bobUser.id,
    `Peer accepted call`
  );

  // SDP Offer / Answer Exchange
  const sdpOfferPromise = new Promise<any>((resolve) => {
    bobSocket.on(SOCKET_EVENTS.CALL_OFFER, (payload: any) => {
      resolve(payload);
    });
  });

  aliceSocket.emit(SOCKET_EVENTS.CALL_OFFER, {
    recipientId: bobUser.id,
    sdp: { type: 'offer', sdp: 'v=0\r\no=alice 12345 12345 IN IP4 127.0.0.1\r\ns=ChatSO' },
  });

  const offerPayload = await Promise.race([
    sdpOfferPromise,
    sleep(3000).then(() => null),
  ]);

  report(
    '15. WebRTC SDP Offer Relay (call:offer)',
    !!offerPayload && offerPayload.sdp.type === 'offer',
    'SDP Offer relayed to recipient'
  );

  // ICE Candidate Trickle Exchange
  const iceCandPromise = new Promise<any>((resolve) => {
    bobSocket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, (payload: any) => {
      resolve(payload);
    });
  });

  aliceSocket.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
    targetId: bobUser.id,
    candidate: { candidate: 'candidate:1 1 UDP 2122260223 127.0.0.1 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  });

  const iceCandPayload = await Promise.race([
    iceCandPromise,
    sleep(3000).then(() => null),
  ]);

  report(
    '16. WebRTC ICE Candidate Trickle (call:ice_candidate)',
    !!iceCandPayload && iceCandPayload.senderId === aliceUser.id,
    'ICE candidate relayed'
  );

  // End Call & Resource Teardown
  const callEndPromise = new Promise<any>((resolve) => {
    bobSocket.on(SOCKET_EVENTS.CALL_END, (payload: any) => {
      resolve(payload);
    });
  });

  aliceSocket.emit(SOCKET_EVENTS.CALL_END, { peerId: bobUser.id });
  const endPayload = await Promise.race([
    callEndPromise,
    sleep(3000).then(() => null),
  ]);

  report(
    '17. WebRTC Call Teardown & Reset (call:end)',
    !!endPayload && endPayload.peerId === aliceUser.id,
    'State reset to IDLE and media released'
  );

  // Disconnect Sockets
  aliceSocket.disconnect();
  bobSocket.disconnect();

  console.log('\n====================================================');
  console.log(`   ALL ${passedSteps}/17 VERIFICATION STEPS PASSED!`);
  console.log('====================================================\n');
  process.exit(0);
}

verify().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});

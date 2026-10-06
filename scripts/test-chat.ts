import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '@chatso/shared';

const API_BASE = 'http://localhost:3001/api';
const SERVER_URL = 'http://localhost:3001';

async function testChat() {
  console.log('--- Logging in Alice & Bob ---');
  const aliceRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'alice_test', password: 'password123' }),
  });
  const alice = await aliceRes.json();

  const bobRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'bob_test', password: 'password123' }),
  });
  const bob = await bobRes.json();

  console.log('Alice ID:', alice.user.id);
  console.log('Bob ID:', bob.user.id);

  const aliceSocket = io(SERVER_URL, {
    auth: { token: alice.token },
    transports: ['websocket'],
  });
  const bobSocket = io(SERVER_URL, {
    auth: { token: bob.token },
    transports: ['websocket'],
  });

  aliceSocket.on('connect_error', (err) => console.error('Alice connect error:', err.message));
  bobSocket.on('connect_error', (err) => console.error('Bob connect error:', err.message));

  await new Promise<void>((resolve) => {
    let count = 0;
    const check = () => { if (++count === 2) resolve(); };
    aliceSocket.on('connect', () => { console.log('Alice connected socket:', aliceSocket.id); check(); });
    bobSocket.on('connect', () => { console.log('Bob connected socket:', bobSocket.id); check(); });
  });

  bobSocket.on(SOCKET_EVENTS.CHAT_RECEIVE, (msg) => {
    console.log('--> Bob received CHAT_RECEIVE:', msg);
  });

  const msgId = crypto.randomUUID();
  console.log('Alice sending CHAT_SEND to Bob (ID: ' + bob.user.id + ')...');

  aliceSocket.emit(
    SOCKET_EVENTS.CHAT_SEND,
    {
      clientMessageId: msgId,
      recipientId: bob.user.id,
      content: 'Hello Bob from isolated test!',
    },
    (ack: any) => {
      console.log('Alice got ACK:', ack);
    }
  );

  await new Promise((r) => setTimeout(r, 3000));
  aliceSocket.disconnect();
  bobSocket.disconnect();
  console.log('Done.');
}

testChat().catch(console.error);

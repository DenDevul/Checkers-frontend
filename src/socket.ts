import { nanoid } from 'nanoid';
import { io } from 'socket.io-client';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const URL = env.PUBLIC_API_WS;
const socket = io(URL, { autoConnect: false, reconnectionAttempts: 9 });

function getUserId(): string {
  if (!browser) return '';

  let userId: string | undefined = localStorage['userId'];
  if (userId && userId.length == 12) return userId;

  userId = nanoid(12);
  localStorage['userId'] = userId;
  return userId;
}

socket.auth = { userId: getUserId() };

export default socket;

import { nanoid } from 'nanoid';
import { io } from 'socket.io-client';
import { browser } from '$app/environment';

const URL = import.meta.env.VITE_API_URL;
const socket = io(URL, { autoConnect: false });

function getUserId(): string {
  if (!browser)
    return ''
  
  let userId: string | undefined = localStorage['userId']
  if (userId && userId.length == 12)
    return userId

  userId = nanoid(12);
  localStorage['userId'] = userId
  return userId;
}

socket.auth = { userId: getUserId() };

export default socket;

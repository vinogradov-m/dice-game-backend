export const getUserRoomName = (userId: number): string => `user_${userId}`;

export const getGameRoomRoomName = (gameRoomId: number): string =>
  `game_room_${gameRoomId}`;

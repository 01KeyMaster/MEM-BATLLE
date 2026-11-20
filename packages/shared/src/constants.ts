// Правила игры в одном месте — их используют и сервер, и клиент.

export const GAME = {
  DECK_SIZE: 24,         // карт в колоде
  HAND_SIZE: 6,          // карт в руке
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 6,
  DEFAULT_WIN_SCORE: 7,  // можно переопределить через WIN_SCORE в .env
  PLAY_SECONDS: 30,      // время на ход
  VOTE_SECONDS: 20,      // время на голосование
  RESULTS_SECONDS: 7,    // показ итогов раунда
  LOBBY_GRACE_SECONDS: 20,   // сколько ждём вернувшегося в лобби, прежде чем убрать
  ABANDON_GRACE_SECONDS: 60, // все люди ушли — через сколько закрыть игру
  BOT_FILL_SECONDS: 30,  // через сколько секунд добавлять ботов
} as const;

export const CUSTOM_SITUATIONS = {
  MAX_PER_OWNER: 10,
  MAX_LENGTH: 200,
} as const;

export const REFERRAL = {
  FRIENDS_PER_REWARD: 3,
} as const;

// Префикс параметра startapp для реферальной ссылки: startapp=ref_<userId>
export const REF_PREFIX = 'ref_';

export type UserProfile = {
  occupation: string;
  hobbies: string[];
  favoriteFoods: string[];
  /** 暦日（例: 7月7日）。JST の日付ずれと混同しない */
  birthday: string;
};

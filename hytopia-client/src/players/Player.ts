import type Game from '../Game';

export interface PlayerData {
  id: string;
  username?: string;
  profilePictureUrl?: string;
}

export default class Player {
  private _game: Game;
  private _id: string;
  private _profilePictureUrl: string;
  private _username: string;

  public constructor(game: Game, data: PlayerData) {
    this._game = game;
    this._id = data.id;
    this._profilePictureUrl = data.profilePictureUrl ?? '';
    this._username = data.username ?? '';
  }

  public get id(): string {
    return this._id;
  }

  public get game(): Game {
    return this._game;
  }

  public get profilePictureUrl(): string {
    return this._profilePictureUrl;
  }

  public get username(): string {
    return this._username;
  }
}
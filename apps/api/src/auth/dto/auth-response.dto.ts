export class AuthResponseDto {
  user: {
    id: string;
    username: string;
    email: string;
    points: number;
    rank: number;
    createdAt: Date;
  };

  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

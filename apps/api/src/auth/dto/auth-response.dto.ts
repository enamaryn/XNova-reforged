export class AuthResponseDto {
  user: {
    id: string;
    username: string;
    email: string;
    points: number;
    rank: number;
    role: string;
    createdAt: Date;
  };

  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

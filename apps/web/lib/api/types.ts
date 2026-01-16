export interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export interface AuthUserDto {
  id: string;
  username: string;
  email: string;
  points: number;
  rank: number;
  role: string;
  createdAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  tokens: AuthTokensDto;
}

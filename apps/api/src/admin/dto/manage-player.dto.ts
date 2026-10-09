import { IsString, Length, MaxLength } from "class-validator";

export class ManagePlayerDto {
  @IsString()
  @Length(1, 20)
  confirmationUsername: string;

  @IsString()
  @Length(3, 2000)
  @MaxLength(2000)
  reason: string;
}

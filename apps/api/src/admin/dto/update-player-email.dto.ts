import { Transform } from "class-transformer";
import { IsEmail, MaxLength } from "class-validator";

export class UpdatePlayerEmailDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;
}

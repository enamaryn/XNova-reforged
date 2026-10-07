import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class SetupSmtpTestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Adresse de destination invalide' })
  to: string;
}

import { validate } from 'class-validator';
import { RenamePlanetDto } from '../src/resources/dto/rename-planet.dto';

describe('DTO validations', () => {
  it('accepte un nom de planete valide', async () => {
    const dto = new RenamePlanetDto();
    dto.name = 'Alpha-2';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('refuse un nom trop court ou invalide', async () => {
    const tooShort = new RenamePlanetDto();
    tooShort.name = 'A';
    const badChars = new RenamePlanetDto();
    badChars.name = 'Alpha@';

    const shortErrors = await validate(tooShort);
    const charErrors = await validate(badChars);

    expect(shortErrors.length).toBeGreaterThan(0);
    expect(charErrors.length).toBeGreaterThan(0);
  });
});

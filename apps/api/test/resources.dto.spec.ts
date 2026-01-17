import { validate } from 'class-validator';
import { GAME_CONSTANTS } from '@xnova/game-config';
import { ColonizePlanetDto } from '../src/resources/dto/colonize-planet.dto';
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

  it('accepte des coordonnees dans les bornes', async () => {
    const dto = new ColonizePlanetDto();
    dto.originPlanetId = 'origin';
    dto.galaxy = 1;
    dto.system = 1;
    dto.position = 1;
    dto.name = 'Colonie';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('refuse des coordonnees hors bornes', async () => {
    const dto = new ColonizePlanetDto();
    dto.originPlanetId = 'origin';
    dto.galaxy = GAME_CONSTANTS.MAX_GALAXIES + 1;
    dto.system = 1;
    dto.position = 1;
    dto.name = 'Colonie';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

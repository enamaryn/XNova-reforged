export interface FleetCoordinates {
  galaxy: number;
  system: number;
  position: number;
}

export interface FleetShipConsumptionInput {
  amount: number;
  consumption: number;
}

export function calculateDistance(
  from: FleetCoordinates,
  to: FleetCoordinates,
): number {
  return Math.sqrt(
    Math.pow(to.galaxy - from.galaxy, 2) * 20000 +
      Math.pow(to.system - from.system, 2) * 95 +
      Math.pow(to.position - from.position, 2) * 5,
  );
}

export function calculateFleetSpeed(shipSpeeds: number[]): number {
  const speeds = shipSpeeds.filter((speed) => speed > 0);
  return speeds.length > 0 ? Math.min(...speeds) : 0;
}

export function calculateFlightDurationSeconds(params: {
  distance: number;
  fleetSpeed: number;
  speedPercent: number;
}): number {
  const percent = Math.min(100, Math.max(10, params.speedPercent));
  const base = (35000 / percent) * Math.sqrt((params.distance * 10) / params.fleetSpeed) + 10;
  return Math.max(1, Math.floor(base));
}

export function calculateFuelConsumption(params: {
  distance: number;
  fleetSpeed: number;
  ships: FleetShipConsumptionInput[];
}): number {
  const factor = Math.pow(params.fleetSpeed / 1000 + 1, 2);
  const distanceRatio = params.distance / 35000;
  const total = params.ships.reduce(
    (sum, ship) => sum + ship.amount * ship.consumption * distanceRatio * factor,
    0,
  );
  return Math.max(0, Math.floor(total));
}

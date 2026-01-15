export * from './buildings';
export * from './technologies';
export * from './ships';
export declare const GAME_CONSTANTS: {
    MAX_GALAXIES: number;
    MAX_SYSTEMS: number;
    MAX_POSITIONS: number;
    MAX_PLAYER_PLANETS: number;
    BASE_STORAGE_SIZE: number;
    MAX_OVERFLOW: number;
    INITIAL_FIELDS: number;
    STARTING_METAL: number;
    STARTING_CRYSTAL: number;
    STARTING_DEUTERIUM: number;
    MAX_BUILDING_QUEUE: number;
    MAX_COMBAT_ROUNDS: number;
    DEBRIS_FACTOR: number;
    DEFENSE_REPAIR_FACTOR: number;
    MINUTE: number;
    HOUR: number;
    DAY: number;
};
export declare enum MissionType {
    ATTACK = 1,
    ACS_ATTACK = 2,
    TRANSPORT = 3,
    DEPLOY = 4,
    HOLD_POSITION = 5,
    SPY = 6,
    COLONIZE = 7,
    RECYCLE = 8,
    DESTROY = 9,
    EXPEDITION = 15
}
export declare enum FleetStatus {
    TRAVELING = "traveling",
    ARRIVED = "arrived",
    RETURNING = "returning",
    COMPLETED = "completed"
}
export declare enum CombatResult {
    ATTACKER_WIN = "attacker_win",
    DEFENDER_WIN = "defender_win",
    DRAW = "draw"
}

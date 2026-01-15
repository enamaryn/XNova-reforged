export * from './buildings';
export * from './technologies';
export * from './ships';
export const GAME_CONSTANTS = {
    MAX_GALAXIES: 9,
    MAX_SYSTEMS: 499,
    MAX_POSITIONS: 15,
    MAX_PLAYER_PLANETS: 21,
    BASE_STORAGE_SIZE: 1000000,
    MAX_OVERFLOW: 1.1,
    INITIAL_FIELDS: 163,
    STARTING_METAL: 500,
    STARTING_CRYSTAL: 500,
    STARTING_DEUTERIUM: 0,
    MAX_BUILDING_QUEUE: 5,
    MAX_COMBAT_ROUNDS: 6,
    DEBRIS_FACTOR: 0.3,
    DEFENSE_REPAIR_FACTOR: 0.7,
    MINUTE: 60,
    HOUR: 3600,
    DAY: 86400,
};
export var MissionType;
(function (MissionType) {
    MissionType[MissionType["ATTACK"] = 1] = "ATTACK";
    MissionType[MissionType["ACS_ATTACK"] = 2] = "ACS_ATTACK";
    MissionType[MissionType["TRANSPORT"] = 3] = "TRANSPORT";
    MissionType[MissionType["DEPLOY"] = 4] = "DEPLOY";
    MissionType[MissionType["HOLD_POSITION"] = 5] = "HOLD_POSITION";
    MissionType[MissionType["SPY"] = 6] = "SPY";
    MissionType[MissionType["COLONIZE"] = 7] = "COLONIZE";
    MissionType[MissionType["RECYCLE"] = 8] = "RECYCLE";
    MissionType[MissionType["DESTROY"] = 9] = "DESTROY";
    MissionType[MissionType["EXPEDITION"] = 15] = "EXPEDITION";
})(MissionType || (MissionType = {}));
export var FleetStatus;
(function (FleetStatus) {
    FleetStatus["TRAVELING"] = "traveling";
    FleetStatus["ARRIVED"] = "arrived";
    FleetStatus["RETURNING"] = "returning";
    FleetStatus["COMPLETED"] = "completed";
})(FleetStatus || (FleetStatus = {}));
export var CombatResult;
(function (CombatResult) {
    CombatResult["ATTACKER_WIN"] = "attacker_win";
    CombatResult["DEFENDER_WIN"] = "defender_win";
    CombatResult["DRAW"] = "draw";
})(CombatResult || (CombatResult = {}));
//# sourceMappingURL=index.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CombatResult = exports.FleetStatus = exports.MissionType = exports.GAME_CONSTANTS = void 0;
__exportStar(require("./buildings"), exports);
__exportStar(require("./technologies"), exports);
__exportStar(require("./ships"), exports);
exports.GAME_CONSTANTS = {
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
var MissionType;
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
})(MissionType || (exports.MissionType = MissionType = {}));
var FleetStatus;
(function (FleetStatus) {
    FleetStatus["TRAVELING"] = "traveling";
    FleetStatus["ARRIVED"] = "arrived";
    FleetStatus["RETURNING"] = "returning";
    FleetStatus["COMPLETED"] = "completed";
})(FleetStatus || (exports.FleetStatus = FleetStatus = {}));
var CombatResult;
(function (CombatResult) {
    CombatResult["ATTACKER_WIN"] = "attacker_win";
    CombatResult["DEFENDER_WIN"] = "defender_win";
    CombatResult["DRAW"] = "draw";
})(CombatResult || (exports.CombatResult = CombatResult = {}));
//# sourceMappingURL=index.js.map
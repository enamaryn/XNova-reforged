export interface ShipCost {
    metal: number;
    crystal: number;
    deuterium: number;
}
export interface ShipStats {
    hull: number;
    shield: number;
    weapon: number;
}
export interface Ship {
    id: number;
    name: string;
    description: string;
    cost: ShipCost;
    stats: ShipStats;
    speed: number;
    cargo: number;
    consumption: number;
    rapidfire?: Record<number, number>;
    requirements?: Record<string, number>;
}
export declare const SHIPS: Record<number, Ship>;
export declare function getShipSpeed(shipId: number, combustionLevel: number, impulseLevel: number, hyperspaceLevel: number): number;
